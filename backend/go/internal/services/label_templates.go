package services

import (
	"fmt"
	"strings"
)

type LabelTemplateDefinition struct {
	SystemKey     string
	Name          string
	Description   string
	Target        string
	DPI           int
	WidthMM       int
	HeightMM      int
	GapMM         float64
	Speed         int
	Density       int
	Direction     int
	ReferenceX    int
	ReferenceY    int
	ShiftX        int
	ShiftY        int
	CopiesDefault int
	IsDefault     bool
	TSPLTemplate  string
}

type LabelTemplateVariable struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Target      string `json:"target"`
	Description string `json:"description"`
}

func DefaultLabelTemplates() []LabelTemplateDefinition {
	return []LabelTemplateDefinition{
		{
			SystemKey:     "qr-only-20x20",
			Name:          "QR only 20x20",
			Description:   "Compact QR label for items and locations.",
			Target:        "both",
			DPI:           600,
			WidthMM:       20,
			HeightMM:      20,
			GapMM:         3,
			Speed:         4,
			Density:       8,
			Direction:     1,
			CopiesDefault: 1,
			IsDefault:     true,
			TSPLTemplate: strings.TrimSpace(`
SIZE 20 mm,20 mm
GAP 3 mm,0 mm
SPEED 4
DENSITY 8
DIRECTION 1
CODEPAGE 1252
CLS
QRCODE 55,55,H,13,A,0,M2,"{{qr_content}}"
PRINT 1
`),
		},
	}
}

func LabelTemplateVariables() []LabelTemplateVariable {
	return []LabelTemplateVariable{
		{Key: "qr_content", Label: "QR content", Target: "both", Description: "Final QR payload for the selected entity."},
		{Key: "realm", Label: "Realm", Target: "both", Description: "Entity realm: archive or collection."},
		{Key: "entity_type", Label: "Entity type", Target: "both", Description: "Entity type: item or location."},
		{Key: "entity_id", Label: "Entity ID", Target: "both", Description: "Numeric ID of the selected entity."},
		{Key: "item_name", Label: "Item name", Target: "item", Description: "Display name of the selected item."},
		{Key: "item_description", Label: "Item description", Target: "item", Description: "Description of the selected item."},
		{Key: "category_name", Label: "Category name", Target: "item", Description: "Category name of the selected item."},
		{Key: "location_name", Label: "Location name", Target: "both", Description: "Resolved location name."},
		{Key: "purchase_price", Label: "Purchase price", Target: "item", Description: "Formatted purchase price."},
		{Key: "purchase_currency", Label: "Purchase currency", Target: "item", Description: "Purchase currency code."},
		{Key: "location_description", Label: "Location description", Target: "location", Description: "Description of the selected location."},
		{Key: "parent_location_name", Label: "Parent location name", Target: "location", Description: "Parent location name, if present."},
	}
}

func SupportedTSPLCommands() []string {
	return []string{
		"SIZE",
		"GAP",
		"SPEED",
		"DENSITY",
		"DIRECTION",
		"CODEPAGE",
		"REFERENCE",
		"SHIFT",
		"CLS",
		"TEXT",
		"BAR",
		"BOX",
		"QRCODE",
		"PRINT",
	}
}

func IsValidLabelTemplateTarget(target string) bool {
	switch target {
	case "item", "location", "both":
		return true
	default:
		return false
	}
}

func ValidateLabelTemplateDefinition(name, target string, widthMM, heightMM int, gapMM float64, speed, density, direction, copiesDefault int, tsplTemplate string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("Template name is required")
	}
	if !IsValidLabelTemplateTarget(target) {
		return fmt.Errorf("Invalid template target")
	}
	if widthMM < 10 || widthMM > 200 {
		return fmt.Errorf("Width must be between 10 and 200 mm")
	}
	if heightMM < 10 || heightMM > 200 {
		return fmt.Errorf("Height must be between 10 and 200 mm")
	}
	if gapMM < 0 || gapMM > 20 {
		return fmt.Errorf("Gap must be between 0 and 20 mm")
	}
	if speed < 1 || speed > 15 {
		return fmt.Errorf("Speed must be between 1 and 15")
	}
	if density < 0 || density > 15 {
		return fmt.Errorf("Density must be between 0 and 15")
	}
	if direction != 0 && direction != 1 {
		return fmt.Errorf("Direction must be 0 or 1")
	}
	if copiesDefault < 1 || copiesDefault > 999999999 {
		return fmt.Errorf("Copies default must be between 1 and 999999999")
	}
	if strings.TrimSpace(tsplTemplate) == "" {
		return fmt.Errorf("TSPL template is required")
	}
	if len(tsplTemplate) > 64*1024 {
		return fmt.Errorf("TSPL template is too large")
	}
	return nil
}

func IsValidLabelTemplateDPI(dpi int) bool {
	switch dpi {
	case 203, 300, 600:
		return true
	default:
		return false
	}
}

func ValidateLabelTemplateDefinitionWithDPI(name, target string, dpi, widthMM, heightMM int, gapMM float64, speed, density, direction, copiesDefault int, tsplTemplate string) error {
	if !IsValidLabelTemplateDPI(dpi) {
		return fmt.Errorf("DPI must be one of 203, 300, or 600")
	}
	return ValidateLabelTemplateDefinition(name, target, widthMM, heightMM, gapMM, speed, density, direction, copiesDefault, tsplTemplate)
}
