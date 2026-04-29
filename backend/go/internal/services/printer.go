package services

import (
	"fmt"
	"log"
	"net"
	"strings"
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

	payload := EnsureTSPLTerminated(tspl)

	_, err = conn.Write([]byte(payload))
	if err != nil {
		log.Printf("Printer write error: %v", err)
		return false
	}

	time.Sleep(500 * time.Millisecond)
	log.Printf("TSPL sent to %s (%d bytes)", addr, len(payload))
	return true
}

// EnsureTSPLTerminated makes sure the payload ends with a printer-friendly line terminator.
func EnsureTSPLTerminated(tspl string) string {
	trimmed := strings.TrimRight(tspl, "\r\n")
	if trimmed == "" {
		return "\n\r"
	}
	return trimmed + "\n\r"
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
