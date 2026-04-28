package services

import (
	"fmt"
	"log"
	"net"
	"time"

	"github.com/itemplus/backend/internal/config"
)

// CompactQR generates the compact QR code content.
func CompactQR(realm, entityType string, entityID int) string {
	prefix := "a"
	if realm == "collection" {
		prefix = "c"
	}
	t := "i"
	if entityType == "location" {
		t = "l"
	}
	return fmt.Sprintf("itp://%s/%s/%08d", prefix, t, entityID)
}

// GenerateQRTSPL generates TSPL commands for a QR label.
func GenerateQRTSPL(qrContent string, copies int) string {
	w := config.C.PrinterLabelWidth
	h := config.C.PrinterLabelHeight
	gap := config.C.PrinterGap
	speed := config.C.PrinterSpeed
	density := config.C.PrinterDensity

	return fmt.Sprintf(`SIZE %d mm, %d mm
GAP %.1f mm, 0 mm
SPEED %d
DENSITY %d
DIRECTION 1
CODEPAGE 1252
CLS
QRCODE 55,55,H,13,A,0,M2,"%s"
PRINT %d
`, w, h, gap, speed, density, qrContent, copies)
}

// SendTSPL sends TSPL commands to the printer via TCP.
func SendTSPL(tspl string) bool {
	host := config.C.PrinterHost
	port := config.C.PrinterPort
	if host == "" {
		log.Println("Printer host not configured")
		return false
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		log.Printf("Printer connection error: %v", err)
		return false
	}
	defer conn.Close()

	_, err = conn.Write([]byte(tspl))
	if err != nil {
		log.Printf("Printer write error: %v", err)
		return false
	}

	time.Sleep(500 * time.Millisecond)
	log.Printf("TSPL sent to %s (%d bytes)", addr, len(tspl))
	return true
}

// TestConnection checks if the printer is reachable.
func TestPrinterConnection() bool {
	host := config.C.PrinterHost
	port := config.C.PrinterPort
	if host == "" {
		return false
	}

	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), 5*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
