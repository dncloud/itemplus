package settings

import (
	"testing"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/testdb"
)

func TestHexColorValidation(t *testing.T) {
	if !hexColorRe.MatchString("00ff99") {
		t.Fatal("expected valid hex color to pass")
	}
	if hexColorRe.MatchString(`fff" onload="alert(1)`) {
		t.Fatal("expected invalid SVG-breaking color to fail")
	}
}

// The printer address set in the web app used to be forgotten on restart.
func TestPrinterConfigSurvivesRestart(t *testing.T) {
	testdb.Use(t)
	previousHost, previousPort := config.C.PrinterHost, config.C.PrinterPort
	t.Cleanup(func() { config.C.PrinterHost, config.C.PrinterPort = previousHost, previousPort })

	// Nothing saved yet: the values from the configuration file stay.
	config.C.PrinterHost, config.C.PrinterPort = "from-config-file", 9100
	ApplyStoredPrinterConfig()
	if config.C.PrinterHost != "from-config-file" || config.C.PrinterPort != 9100 {
		t.Fatalf("defaults were changed without a saved setting: %s:%d", config.C.PrinterHost, config.C.PrinterPort)
	}

	config.C.PrinterHost, config.C.PrinterPort = "192.168.1.50", 9101
	if err := storePrinterConfig(); err != nil {
		t.Fatalf("storePrinterConfig: %v", err)
	}

	// A restart begins with the configuration file again.
	config.C.PrinterHost, config.C.PrinterPort = "from-config-file", 9100
	ApplyStoredPrinterConfig()
	if config.C.PrinterHost != "192.168.1.50" || config.C.PrinterPort != 9101 {
		t.Fatalf("after restart: %s:%d, want the saved 192.168.1.50:9101", config.C.PrinterHost, config.C.PrinterPort)
	}

	// Clearing the host in the web app is remembered as well.
	config.C.PrinterHost = ""
	if err := storePrinterConfig(); err != nil {
		t.Fatal(err)
	}
	config.C.PrinterHost = "from-config-file"
	ApplyStoredPrinterConfig()
	if config.C.PrinterHost != "" {
		t.Fatalf("a cleared printer host came back as %q", config.C.PrinterHost)
	}
}
