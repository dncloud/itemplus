package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/services"
	"github.com/jmoiron/sqlx"
)

type labelTemplate struct {
	ID            int     `db:"id" json:"id"`
	SystemKey     *string `db:"system_key" json:"system_key"`
	Name          string  `db:"name" json:"name"`
	Description   *string `db:"description" json:"description"`
	Target        string  `db:"target" json:"target"`
	DPI           int     `db:"dpi" json:"dpi"`
	WidthMM       int     `db:"width_mm" json:"width_mm"`
	HeightMM      int     `db:"height_mm" json:"height_mm"`
	GapMM         float64 `db:"gap_mm" json:"gap_mm"`
	Speed         int     `db:"speed" json:"speed"`
	Density       int     `db:"density" json:"density"`
	Direction     int     `db:"direction" json:"direction"`
	ReferenceX    int     `db:"reference_x" json:"reference_x"`
	ReferenceY    int     `db:"reference_y" json:"reference_y"`
	ShiftX        int     `db:"shift_x" json:"shift_x"`
	ShiftY        int     `db:"shift_y" json:"shift_y"`
	CopiesDefault int     `db:"copies_default" json:"copies_default"`
	IsDefault     bool    `db:"is_default" json:"is_default"`
	IsSystem      bool    `db:"is_system" json:"is_system"`
	IsActive      bool    `db:"is_active" json:"is_active"`
	TSPLTemplate  string  `db:"tspl_template" json:"tspl_template"`
	CreatedAt     *string `db:"created_at" json:"created_at"`
	UpdatedAt     *string `db:"updated_at" json:"updated_at"`
}

type labelTemplatePayload struct {
	Name          *string  `json:"name"`
	Description   *string  `json:"description"`
	Target        *string  `json:"target"`
	DPI           *int     `json:"dpi"`
	WidthMM       *int     `json:"width_mm"`
	HeightMM      *int     `json:"height_mm"`
	GapMM         *float64 `json:"gap_mm"`
	Speed         *int     `json:"speed"`
	Density       *int     `json:"density"`
	Direction     *int     `json:"direction"`
	ReferenceX    *int     `json:"reference_x"`
	ReferenceY    *int     `json:"reference_y"`
	ShiftX        *int     `json:"shift_x"`
	ShiftY        *int     `json:"shift_y"`
	CopiesDefault *int     `json:"copies_default"`
	IsDefault     *bool    `json:"is_default"`
	IsActive      *bool    `json:"is_active"`
	TSPLTemplate  *string  `json:"tspl_template"`
}

func registerLabelTemplateRoutes(g *gin.RouterGroup) {
	g.GET("/templates/meta", middleware.Auth(), middleware.RequirePermission("print"), getLabelTemplateMeta)
	g.GET("/templates", middleware.Auth(), middleware.RequirePermission("print"), listLabelTemplates)
	g.GET("/templates/:id", middleware.Auth(), middleware.RequirePermission("print"), getLabelTemplate)
	g.POST("/templates", middleware.Auth(), middleware.RequireAdmin(), createLabelTemplate)
	g.PUT("/templates/:id", middleware.Auth(), middleware.RequireAdmin(), updateLabelTemplate)
	g.POST("/templates/:id/default", middleware.Auth(), middleware.RequireAdmin(), setDefaultLabelTemplate)
	g.DELETE("/templates/:id", middleware.Auth(), middleware.RequireAdmin(), deleteLabelTemplate)
}

func getLabelTemplateMeta(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"targets":            []string{"item", "location", "both"},
		"dpis":               []int{203, 300, 600},
		"supported_commands": services.SupportedTSPLCommands(),
		"variables":          services.LabelTemplateVariables(),
	})
}

func listLabelTemplates(c *gin.Context) {
	target := strings.TrimSpace(c.Query("target"))
	includeInactive := c.Query("include_inactive") == "1"

	query := `SELECT * FROM label_templates`
	args := []interface{}{}
	clauses := []string{}

	if target != "" {
		if !services.IsValidLabelTemplateTarget(target) {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid template target"})
			return
		}
		clauses = append(clauses, "(target = ? OR target = 'both')")
		args = append(args, target)
	}
	if !includeInactive {
		clauses = append(clauses, "is_active = 1")
	}
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY is_default DESC, is_system DESC, " + database.CaseInsensitiveOrder("name")

	var templates []labelTemplate
	if err := database.DB.Select(&templates, query, args...); err != nil {
		log.Printf("DB query error in listLabelTemplates: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if templates == nil {
		templates = []labelTemplate{}
	}
	c.JSON(http.StatusOK, templates)
}

func getLabelTemplate(c *gin.Context) {
	id, ok := parseLabelTemplateID(c)
	if !ok {
		return
	}

	tpl, err := loadLabelTemplate(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Label template not found"})
		return
	}
	c.JSON(http.StatusOK, tpl)
}

func beginLabelTemplateTx(c *gin.Context) (*sqlx.Tx, bool) {
	tx, err := database.DB.Beginx()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return nil, false
	}
	return tx, true
}

func respondLabelTemplate(c *gin.Context, id int, status int) {
	tpl, _ := loadLabelTemplate(id)
	c.JSON(status, tpl)
}

func createLabelTemplate(c *gin.Context) {
	var body labelTemplatePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	if body.Name == nil || body.Target == nil || body.DPI == nil || body.WidthMM == nil || body.HeightMM == nil || body.GapMM == nil ||
		body.Speed == nil || body.Density == nil || body.Direction == nil || body.CopiesDefault == nil || body.TSPLTemplate == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Missing required fields"})
		return
	}

	description := nullableTrimmedString(body.Description)
	name := strings.TrimSpace(*body.Name)
	target := strings.TrimSpace(*body.Target)
	tsplTemplate := normalizeMultiline(*body.TSPLTemplate)

	if err := services.ValidateLabelTemplateDefinitionWithDPI(name, target, *body.DPI, *body.WidthMM, *body.HeightMM, *body.GapMM, *body.Speed, *body.Density, *body.Direction, *body.CopiesDefault, tsplTemplate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	now := database.TimestampNow()
	tx, ok := beginLabelTemplateTx(c)
	if !ok {
		return
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO label_templates (
			name, description, target, dpi, width_mm, height_mm, gap_mm, speed, density, direction,
			reference_x, reference_y, shift_x, shift_y, copies_default, is_default, is_system, is_active,
			tspl_template, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
		name, description, target, *body.DPI, *body.WidthMM, *body.HeightMM, *body.GapMM, *body.Speed, *body.Density, *body.Direction,
		intValue(body.ReferenceX), intValue(body.ReferenceY), intValue(body.ShiftX), intValue(body.ShiftY),
		*body.CopiesDefault, boolValue(body.IsDefault), boolDefault(body.IsActive, true), tsplTemplate, now, now,
	)
	if err != nil {
		log.Printf("DB insert error in createLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be created"})
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	if boolValue(body.IsDefault) {
		if err := clearTemplateDefaults(tx, target, id); err != nil {
			log.Printf("DB default update error in createLabelTemplate: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be created"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in createLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be created"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "label_template.create", "template_id="+strconv.Itoa(id))
	respondLabelTemplate(c, id, http.StatusCreated)
}

func updateLabelTemplate(c *gin.Context) {
	id, ok := parseLabelTemplateID(c)
	if !ok {
		return
	}

	current, err := loadLabelTemplate(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Label template not found"})
		return
	}

	var body labelTemplatePayload
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}

	name := current.Name
	if body.Name != nil {
		name = strings.TrimSpace(*body.Name)
	}
	description := current.Description
	if body.Description != nil {
		description = nullableTrimmedString(body.Description)
	}
	target := current.Target
	if body.Target != nil {
		target = strings.TrimSpace(*body.Target)
	}
	dpi := current.DPI
	if body.DPI != nil {
		dpi = *body.DPI
	}
	widthMM := current.WidthMM
	if body.WidthMM != nil {
		widthMM = *body.WidthMM
	}
	heightMM := current.HeightMM
	if body.HeightMM != nil {
		heightMM = *body.HeightMM
	}
	gapMM := current.GapMM
	if body.GapMM != nil {
		gapMM = *body.GapMM
	}
	speed := current.Speed
	if body.Speed != nil {
		speed = *body.Speed
	}
	density := current.Density
	if body.Density != nil {
		density = *body.Density
	}
	direction := current.Direction
	if body.Direction != nil {
		direction = *body.Direction
	}
	referenceX := current.ReferenceX
	if body.ReferenceX != nil {
		referenceX = *body.ReferenceX
	}
	referenceY := current.ReferenceY
	if body.ReferenceY != nil {
		referenceY = *body.ReferenceY
	}
	shiftX := current.ShiftX
	if body.ShiftX != nil {
		shiftX = *body.ShiftX
	}
	shiftY := current.ShiftY
	if body.ShiftY != nil {
		shiftY = *body.ShiftY
	}
	copiesDefault := current.CopiesDefault
	if body.CopiesDefault != nil {
		copiesDefault = *body.CopiesDefault
	}
	isDefault := current.IsDefault
	if body.IsDefault != nil {
		isDefault = *body.IsDefault
	}
	isActive := current.IsActive
	if body.IsActive != nil {
		isActive = *body.IsActive
	}
	tsplTemplate := current.TSPLTemplate
	if body.TSPLTemplate != nil {
		tsplTemplate = normalizeMultiline(*body.TSPLTemplate)
	}

	if err := services.ValidateLabelTemplateDefinitionWithDPI(name, target, dpi, widthMM, heightMM, gapMM, speed, density, direction, copiesDefault, tsplTemplate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	now := database.TimestampNow()
	tx, ok := beginLabelTemplateTx(c)
	if !ok {
		return
	}
	defer tx.Rollback()

	if current.IsDefault && current.Target != target {
		if _, err := tx.Exec("UPDATE label_templates SET is_default = 0, updated_at = ? WHERE target = ?", now, current.Target); err != nil {
			log.Printf("DB old-target default update error in updateLabelTemplate: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
			return
		}
	}

	_, err = tx.Exec(
		`UPDATE label_templates SET
			name = ?, description = ?, target = ?, dpi = ?, width_mm = ?, height_mm = ?, gap_mm = ?, speed = ?, density = ?,
			direction = ?, reference_x = ?, reference_y = ?, shift_x = ?, shift_y = ?, copies_default = ?,
			is_default = ?, is_active = ?, tspl_template = ?, updated_at = ?
		WHERE id = ?`,
		name, description, target, dpi, widthMM, heightMM, gapMM, speed, density,
		direction, referenceX, referenceY, shiftX, shiftY, copiesDefault,
		isDefault, isActive, tsplTemplate, now, id,
	)
	if err != nil {
		log.Printf("DB update error in updateLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
		return
	}

	if isDefault {
		if err := clearTemplateDefaults(tx, target, id); err != nil {
			log.Printf("DB default update error in updateLabelTemplate: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in updateLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "label_template.update", "template_id="+strconv.Itoa(id))
	respondLabelTemplate(c, id, http.StatusOK)
}

func setDefaultLabelTemplate(c *gin.Context) {
	id, ok := parseLabelTemplateID(c)
	if !ok {
		return
	}

	current, err := loadLabelTemplate(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Label template not found"})
		return
	}

	tx, ok := beginLabelTemplateTx(c)
	if !ok {
		return
	}
	defer tx.Rollback()

	if err := clearTemplateDefaults(tx, current.Target, id); err != nil {
		log.Printf("DB default update error in setDefaultLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
		return
	}
	if _, err := tx.Exec("UPDATE label_templates SET is_active = 1, updated_at = ? WHERE id = ?", database.TimestampNow(), id); err != nil {
		log.Printf("DB update error in setDefaultLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("DB commit error in setDefaultLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be updated"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "label_template.default", "template_id="+strconv.Itoa(id))
	respondLabelTemplate(c, id, http.StatusOK)
}

func deleteLabelTemplate(c *gin.Context) {
	id, ok := parseLabelTemplateID(c)
	if !ok {
		return
	}

	if _, err := loadLabelTemplate(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Label template not found"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM label_templates WHERE id = ?", id)
	if err != nil {
		log.Printf("DB delete error in deleteLabelTemplate: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Label template could not be deleted"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Label template not found"})
		return
	}

	user := middleware.GetUser(c)
	audit(user.ID, "label_template.delete", "template_id="+strconv.Itoa(id))
	c.Status(http.StatusNoContent)
}

func parseLabelTemplateID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid label template id"})
		return 0, false
	}
	return id, true
}

func loadLabelTemplate(id int) (*labelTemplate, error) {
	var tpl labelTemplate
	if err := database.DB.Get(&tpl, "SELECT * FROM label_templates WHERE id = ?", id); err != nil {
		return nil, err
	}
	return &tpl, nil
}

func clearTemplateDefaults(tx *sqlx.Tx, target string, keepID int) error {
	now := database.TimestampNow()
	if _, err := tx.Exec("UPDATE label_templates SET is_default = 0, updated_at = ? WHERE target = ?", now, target); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE label_templates SET is_default = 1, is_active = 1, updated_at = ? WHERE id = ?", now, keepID); err != nil {
		return err
	}
	return nil
}

func nullableTrimmedString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeMultiline(value string) string {
	return strings.TrimSpace(strings.ReplaceAll(value, "\r\n", "\n"))
}

func intValue(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func boolValue(value *bool) bool {
	return value != nil && *value
}

func boolDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
