package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/printing"
	"github.com/itemplus/backend/internal/services"
	qrcode "github.com/skip2/go-qrcode"
)

var hexColorRe = regexp.MustCompile(`^[0-9a-fA-F]{6}$`)
var printerHostRe = regexp.MustCompile(`^[A-Za-z0-9.-]+$`)

func RegisterPrinterRoutes(g *gin.RouterGroup) {
	g.POST("/:realm/item/:id", middleware.Auth(), middleware.RequirePermission("print"), printItemLabel)
	g.POST("/:realm/location/:id", middleware.Auth(), middleware.RequirePermission("print"), printLocationLabel)
	g.GET("/status", middleware.Auth(), middleware.RequireAdmin(), printerStatus)
	g.POST("/calibrate", middleware.Auth(), middleware.RequireAdmin(), printerCalibrate)
	g.POST("/test", middleware.Auth(), middleware.RequireAdmin(), printerTest)
	g.GET("/test/preview", middleware.Auth(), middleware.RequireAdmin(), printerTestPreview)
	g.GET("/qr/generate.svg", generateQRSVG)
	g.GET("/qr/:realm/:type/:id", generateEntityQR)
	g.PUT("/config", middleware.Auth(), middleware.RequireAdmin(), updatePrinterConfig)
	registerLabelTemplateRoutes(g)
}

func parsePrintCopies(c *gin.Context) int {
	var body struct {
		Copies int `json:"copies"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Copies < 1 {
		return 1
	}
	return body.Copies
}

func sendRenderedLabel(c *gin.Context, realm, entityType, id string) {
	copies := parsePrintCopies(c)
	idInt, _ := strconv.Atoi(id)
	tspl, qr, err := printing.RenderEntityTSPL(realm, entityType, idInt, copies)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "printed", "qr_content": qr, "copies": copies})
}

func printItemLabel(c *gin.Context) {
	sendRenderedLabel(c, c.Param("realm"), "item", c.Param("id"))
}

func printLocationLabel(c *gin.Context) {
	sendRenderedLabel(c, c.Param("realm"), "location", c.Param("id"))
}

func printerStatus(c *gin.Context) {
	reachable := services.TestPrinterConnection()
	c.JSON(http.StatusOK, gin.H{
		"reachable": reachable,
		"host":      config.C.PrinterHost,
		"port":      config.C.PrinterPort,
	})
}

func printerCalibrate(c *gin.Context) {
	tspl, err := printing.CalibrationTSPL()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "calibrated", "tspl": tspl})
}

func printerTest(c *gin.Context) {
	var body struct {
		TSPL *string `json:"tspl"`
	}
	c.ShouldBindJSON(&body)

	var tspl string
	if body.TSPL != nil && *body.TSPL != "" {
		tspl = *body.TSPL
	} else {
		tspl = printing.RenderPreviewTSPL("archive", "item", 0, 1)
	}

	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "printed", "tspl": tspl})
}

func printerTestPreview(c *gin.Context) {
	tspl := printing.RenderPreviewTSPL("archive", "item", 0, 1)
	c.JSON(http.StatusOK, gin.H{"tspl": tspl})
}

func generateQRSVG(c *gin.Context) {
	data := c.Query("data")
	color := c.DefaultQuery("color", "000000")
	if data == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "data parameter required"})
		return
	}
	if len(data) > 2048 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "QR data too long"})
		return
	}
	renderQRSVG(c, data, color)
}

func generateEntityQR(c *gin.Context) {
	realm := c.Param("realm")
	entityType := c.Param("type")
	idStr := c.Param("id")
	color := c.DefaultQuery("color", "000000")

	// Strip .svg suffix
	idStr = strings.TrimSuffix(idStr, ".svg")
	idInt, _ := strconv.Atoi(idStr)

	qr := services.CompactQR(realm, entityType, idInt)
	renderQRSVG(c, qr, color)
}

func renderQRSVG(c *gin.Context, content, color string) {
	if !hexColorRe.MatchString(color) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid color"})
		return
	}

	q, err := qrcode.New(content, qrcode.Low)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "QR generation failed"})
		return
	}
	q.DisableBorder = true

	bitmap := q.Bitmap()
	n := len(bitmap)
	fill := "#" + color

	var paths strings.Builder
	for y, row := range bitmap {
		x := 0
		for x < n {
			if row[x] {
				start := x
				for x < n && row[x] {
					x++
				}
				fmt.Fprintf(&paths, "M%d,%dh%dv1h-%dz", start, y, x-start, x-start)
			} else {
				x++
			}
		}
	}

	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges"><path d="%s" fill="%s"/></svg>`,
		n, n, paths.String(), fill)

	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, "image/svg+xml", []byte(svg))
}

func updatePrinterConfig(c *gin.Context) {
	var body struct {
		Host *string `json:"host"`
		Port *int    `json:"port"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	if body.Host != nil {
		host := strings.TrimSpace(*body.Host)
		if host != "" {
			if _, err := netip.ParseAddr(host); err != nil {
				if host != "localhost" && (!printerHostRe.MatchString(host) || strings.HasPrefix(host, ".") || strings.HasSuffix(host, ".") || strings.Contains(host, "..")) {
					c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid printer host"})
					return
				}
			}
		}
		config.C.PrinterHost = host
	}
	if body.Port != nil {
		if *body.Port < 1 || *body.Port > 65535 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid printer port"})
			return
		}
		config.C.PrinterPort = *body.Port
	}

	user := middleware.GetUser(c)
	audit(user.ID, "config.printer", "")

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// Silence unused import
var _ = io.Discard
