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
}

func printItemLabel(c *gin.Context) {
	realm := c.Param("realm")
	id := c.Param("id")

	var body struct {
		Copies int `json:"copies"`
	}
	c.ShouldBindJSON(&body)
	if body.Copies < 1 {
		body.Copies = 1
	}

	idInt, _ := strconv.Atoi(id)
	qr := services.CompactQR(realm, "item", idInt)
	tspl := services.GenerateQRTSPL(qr, body.Copies)

	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "printed", "qr_content": qr, "copies": body.Copies})
}

func printLocationLabel(c *gin.Context) {
	realm := c.Param("realm")
	id := c.Param("id")

	var body struct {
		Copies int `json:"copies"`
	}
	c.ShouldBindJSON(&body)
	if body.Copies < 1 {
		body.Copies = 1
	}

	idInt, _ := strconv.Atoi(id)
	qr := services.CompactQR(realm, "location", idInt)
	tspl := services.GenerateQRTSPL(qr, body.Copies)

	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "printed", "qr_content": qr, "copies": body.Copies})
}

func printerStatus(c *gin.Context) {
	reachable := services.TestPrinterConnection()
	c.JSON(http.StatusOK, gin.H{
		"reachable":    reachable,
		"host":         config.C.PrinterHost,
		"port":         config.C.PrinterPort,
		"speed":        config.C.PrinterSpeed,
		"density":      config.C.PrinterDensity,
		"label_width":  config.C.PrinterLabelWidth,
		"label_height": config.C.PrinterLabelHeight,
		"gap":          config.C.PrinterGap,
	})
}

func printerCalibrate(c *gin.Context) {
	tspl := fmt.Sprintf("SIZE %d mm, %d mm\nGAP %.1f mm, 0 mm\nGAPDETECT\n",
		config.C.PrinterLabelWidth, config.C.PrinterLabelHeight, config.C.PrinterGap)
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
		qr := services.CompactQR("archive", "item", 0)
		tspl = services.GenerateQRTSPL(qr, 1)
	}

	if !services.SendTSPL(tspl) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"detail": "Printer not reachable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "printed", "tspl": tspl})
}

func printerTestPreview(c *gin.Context) {
	qr := services.CompactQR("archive", "item", 0)
	tspl := services.GenerateQRTSPL(qr, 1)
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
		Host        *string  `json:"host"`
		Port        *int     `json:"port"`
		Speed       *int     `json:"speed"`
		Density     *int     `json:"density"`
		LabelWidth  *int     `json:"label_width"`
		LabelHeight *int     `json:"label_height"`
		Gap         *float64 `json:"gap"`
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
	if body.Speed != nil {
		if *body.Speed < 1 || *body.Speed > 15 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid printer speed"})
			return
		}
		config.C.PrinterSpeed = *body.Speed
	}
	if body.Density != nil {
		if *body.Density < 0 || *body.Density > 15 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid printer density"})
			return
		}
		config.C.PrinterDensity = *body.Density
	}
	if body.LabelWidth != nil {
		if *body.LabelWidth < 10 || *body.LabelWidth > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid label width"})
			return
		}
		config.C.PrinterLabelWidth = *body.LabelWidth
	}
	if body.LabelHeight != nil {
		if *body.LabelHeight < 10 || *body.LabelHeight > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid label height"})
			return
		}
		config.C.PrinterLabelHeight = *body.LabelHeight
	}
	if body.Gap != nil {
		if *body.Gap < 0 || *body.Gap > 20 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid label gap"})
			return
		}
		config.C.PrinterGap = *body.Gap
	}

	user := middleware.GetUser(c)
	audit(user.ID, "config.printer", "")

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// Silence unused import
var _ = io.Discard
