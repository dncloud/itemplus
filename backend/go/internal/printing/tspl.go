package printing

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/services"
)

type labelTemplateRecord struct {
	ID           int     `db:"id"`
	Name         string  `db:"name"`
	Target       string  `db:"target"`
	WidthMM      int     `db:"width_mm"`
	HeightMM     int     `db:"height_mm"`
	GapMM        float64 `db:"gap_mm"`
	IsDefault    bool    `db:"is_default"`
	IsSystem     bool    `db:"is_system"`
	IsActive     bool    `db:"is_active"`
	TSPLTemplate string  `db:"tspl_template"`
}

type itemLabelData struct {
	Name             string   `db:"name"`
	Description      *string  `db:"description"`
	CategoryName     *string  `db:"category_name"`
	LocationName     *string  `db:"location_name"`
	PurchasePrice    *float64 `db:"purchase_price"`
	PurchaseCurrency *string  `db:"purchase_currency"`
}

type locationLabelData struct {
	Name               string  `db:"name"`
	Description        *string `db:"description"`
	ParentLocationName *string `db:"parent_location_name"`
}

var printLinePattern = regexp.MustCompile(`(?im)^[ \t]*PRINT\b[^\r\n]*$`)

func RenderEntityTSPL(realm, entityType string, entityID, copies int) (string, string, error) {
	if realm != "archive" && realm != "collection" {
		return "", "", fmt.Errorf("invalid realm")
	}
	if entityType != "item" && entityType != "location" {
		return "", "", fmt.Errorf("invalid entity type")
	}
	if entityID <= 0 {
		return "", "", fmt.Errorf("invalid entity ID")
	}
	if copies < 1 {
		copies = 1
	}

	tpl, err := loadActiveTemplate(entityType)
	if err != nil {
		return "", "", err
	}

	vars, qrContent, err := loadVariables(realm, entityType, entityID)
	if err != nil {
		return "", "", err
	}

	rendered := renderTemplate(tpl.TSPLTemplate, vars)
	rendered = applyCopies(rendered, copies)
	return services.EnsureTSPLTerminated(rendered), qrContent, nil
}

func RenderPreviewTSPL(realm, entityType string, entityID, copies int) string {
	tpl, err := loadActiveTemplate(entityType)
	if err != nil {
		defs := services.DefaultLabelTemplates()
		if len(defs) == 0 {
			return services.EnsureTSPLTerminated("PRINT 1")
		}
		content := services.CompactQR(realm, entityType, entityID)
		rendered := strings.ReplaceAll(defs[0].TSPLTemplate, "{{qr_content}}", escapeTSPLValue(content))
		return services.EnsureTSPLTerminated(applyCopies(rendered, copies))
	}

	content := services.CompactQR(realm, entityType, entityID)
	rendered := renderTemplate(tpl.TSPLTemplate, map[string]string{
		"qr_content":  content,
		"realm":       realm,
		"entity_type": entityType,
		"entity_id":   strconv.Itoa(entityID),
	})
	return services.EnsureTSPLTerminated(applyCopies(rendered, copies))
}

func CalibrationTSPL() (string, error) {
	tpl, err := loadActiveTemplate("item")
	if err != nil {
		defs := services.DefaultLabelTemplates()
		if len(defs) == 0 {
			return "", fmt.Errorf("no label template available")
		}
		def := defs[0]
		return services.EnsureTSPLTerminated(
			fmt.Sprintf("SIZE %d mm, %d mm\nGAP %.1f mm, 0 mm\nGAPDETECT", def.WidthMM, def.HeightMM, def.GapMM),
		), nil
	}

	return services.EnsureTSPLTerminated(
		fmt.Sprintf("SIZE %d mm, %d mm\nGAP %.1f mm, 0 mm\nGAPDETECT", tpl.WidthMM, tpl.HeightMM, tpl.GapMM),
	), nil
}

func loadActiveTemplate(entityType string) (*labelTemplateRecord, error) {
	var tpl labelTemplateRecord
	err := database.DB.Get(&tpl, `
		SELECT id, name, target, width_mm, height_mm, gap_mm, is_default, is_system, is_active, tspl_template
		FROM label_templates
		WHERE is_active = 1 AND (target = ? OR target = 'both')
		ORDER BY
			CASE WHEN target = ? THEN 0 ELSE 1 END,
			is_default DESC,
			is_system DESC,
	`+database.CaseInsensitiveOrder("name")+`
		LIMIT 1
	`, entityType, entityType)
	if err != nil {
		return nil, fmt.Errorf("no active label template found")
	}
	return &tpl, nil
}

func loadVariables(realm, entityType string, entityID int) (map[string]string, string, error) {
	qrContent := services.CompactQR(realm, entityType, entityID)
	vars := map[string]string{
		"qr_content":  qrContent,
		"realm":       realm,
		"entity_type": entityType,
		"entity_id":   strconv.Itoa(entityID),
	}

	switch entityType {
	case "item":
		row, err := loadItemLabelData(realm, entityID)
		if err != nil {
			return nil, "", err
		}
		vars["item_name"] = row.Name
		vars["item_description"] = deref(row.Description)
		vars["category_name"] = deref(row.CategoryName)
		vars["location_name"] = deref(row.LocationName)
		vars["purchase_price"] = formatPrice(row.PurchasePrice)
		vars["purchase_currency"] = deref(row.PurchaseCurrency)
	case "location":
		row, err := loadLocationLabelData(realm, entityID)
		if err != nil {
			return nil, "", err
		}
		vars["location_name"] = row.Name
		vars["location_description"] = deref(row.Description)
		vars["parent_location_name"] = deref(row.ParentLocationName)
	}

	return vars, qrContent, nil
}

func loadItemLabelData(realm string, entityID int) (*itemLabelData, error) {
	var row itemLabelData
	query := fmt.Sprintf(`
		SELECT
			i.name,
			i.description,
			c.name AS category_name,
			l.name AS location_name,
			i.purchase_price,
			i.purchase_currency
		FROM %s_items i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		WHERE i.id = ?
	`, realm, realm, realm)
	if err := database.DB.Get(&row, query, entityID); err != nil {
		return nil, fmt.Errorf("item not found")
	}
	return &row, nil
}

func loadLocationLabelData(realm string, entityID int) (*locationLabelData, error) {
	var row locationLabelData
	query := fmt.Sprintf(`
		SELECT
			l.name,
			l.description,
			p.name AS parent_location_name
		FROM %s_locations l
		LEFT JOIN %s_locations p ON l.parent_id = p.id
		WHERE l.id = ?
	`, realm, realm)
	if err := database.DB.Get(&row, query, entityID); err != nil {
		return nil, fmt.Errorf("location not found")
	}
	return &row, nil
}

func renderTemplate(template string, vars map[string]string) string {
	replacements := make([]string, 0, len(vars)*2)
	for key, value := range vars {
		replacements = append(replacements, "{{"+key+"}}", escapeTSPLValue(value))
	}
	return strings.NewReplacer(replacements...).Replace(template)
}

func applyCopies(tspl string, copies int) string {
	if copies < 1 {
		copies = 1
	}
	printLine := fmt.Sprintf("PRINT %d", copies)
	if printLinePattern.MatchString(tspl) {
		return printLinePattern.ReplaceAllString(tspl, printLine)
	}
	trimmed := strings.TrimRight(tspl, "\r\n")
	if trimmed == "" {
		return printLine
	}
	return trimmed + "\n" + printLine
}

func formatPrice(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', 2, 64)
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func escapeTSPLValue(value string) string {
	value = strings.ReplaceAll(value, "\r\n", " ")
	value = strings.ReplaceAll(value, "\n", " ")
	value = strings.ReplaceAll(value, "\r", " ")
	value = strings.ReplaceAll(value, `"`, `[\"]`)
	return value
}
