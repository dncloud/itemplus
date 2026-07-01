package printing

import (
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
)

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
	if _, err = conn.Write([]byte(payload)); err != nil {
		log.Printf("Printer write error: %v", err)
		return false
	}

	time.Sleep(500 * time.Millisecond)
	log.Printf("TSPL sent to %s (%d bytes)", addr, len(payload))
	return true
}

func EnsureTSPLTerminated(tspl string) string {
	trimmed := strings.TrimRight(tspl, "\r\n")
	if trimmed == "" {
		return "\n\r"
	}
	return trimmed + "\n\r"
}

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
	_ = conn.Close()
	return true
}
