package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/middleware"
	"github.com/itemplus/backend/internal/storage"
	"github.com/itemplus/backend/internal/ws"
	"github.com/jmoiron/sqlx"
)

func RegisterItemRoutes(g *gin.RouterGroup, realm string) {
	uploadRL := middleware.RateLimit(20, time.Minute)
	listRL := middleware.RateLimit(120, time.Minute)

	g.GET("", middleware.Auth(), middleware.RequirePermission("items.read"), listRL, listItems(realm))
	g.GET("/lookup", middleware.Auth(), middleware.RequirePermission("items.read"), listItemLookup(realm))
	g.GET("/:id", middleware.Auth(), middleware.RequirePermission("items.read"), getItem(realm))
	g.POST("", middleware.Auth(), middleware.RequirePermission("items.write"), createItem(realm))
	g.PUT("/:id", middleware.Auth(), middleware.RequirePermission("items.write"), updateItem(realm))
	g.DELETE("/:id", middleware.Auth(), middleware.RequirePermission("items.delete"), deleteItem(realm))

	// Attachments
	g.POST("/:id/attachments", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadAttachment(realm))
	g.POST("/:id/attachments/link", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), addLinkAttachment(realm))
	g.POST("/:id/attachments/external-sftp", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), addExternalSFTPAttachment(realm))

	// Property file upload
	g.POST("/:id/properties/:propId/upload", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadPropertyFile(realm))
}

func RegisterAttachmentRoutes(g *gin.RouterGroup, realm string) {
	g.GET("/external-sources", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), listAttachmentExternalSources)
	g.GET("/external-sources/:id/browse", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), browseAttachmentExternalSource)
	g.GET("/:attId/content", middleware.Auth(), middleware.RequirePermission("items.read"), getAttachmentContent(realm))
	g.PUT("/:attId", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), updateAttachment(realm))
	g.DELETE("/:attId", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), deleteAttachment(realm))
}

func listItems(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"
	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	attachTable := realm + "_attachments"
	checkoutTable := realm + "_checkouts"

	return func(c *gin.Context) {
		search := c.Query("search")
		categoryID := c.Query("category_id")
		locationID := c.Query("location_id")
		status := c.Query("status")
		sortField := c.DefaultQuery("sort", "id")
		sortOrder := c.DefaultQuery("order", "desc")
		pageStr := c.DefaultQuery("page", "1")
		perPageStr := c.DefaultQuery("per_page", "50")

		page, _ := strconv.Atoi(pageStr)
		perPage, _ := strconv.Atoi(perPageStr)
		if page < 1 {
			page = 1
		}
		if perPage <= 0 || perPage > 200 {
			perPage = 50
		}
		offset := (page - 1) * perPage

		sortMap := map[string]string{
			"id": "i.id", "name": "i.name", "price": "i.purchase_price", "quantity": "i.quantity",
			"created": "i.created_at", "updated": "i.updated_at",
		}
		sortCol := "i.id"
		if col, ok := sortMap[sortField]; ok {
			sortCol = col
		}
		if sortOrder != "asc" {
			sortOrder = "desc"
		}

		orderClause := fmt.Sprintf("%s %s", sortCol, sortOrder)
		switch sortField {
		case "price", "quantity":
			orderClause = fmt.Sprintf("%s %s, i.name ASC, i.id DESC", sortCol, sortOrder)
		case "name":
			orderClause = fmt.Sprintf("i.name %s, i.id DESC", sortOrder)
		case "created", "updated":
			orderClause = fmt.Sprintf("%s %s, i.id DESC", sortCol, sortOrder)
		case "id":
			orderClause = fmt.Sprintf("i.id %s", sortOrder)
		default:
			orderClause = fmt.Sprintf("i.id %s", sortOrder)
		}

		// Build query
		query := fmt.Sprintf(`SELECT i.*,
			c.name AS category_name,
			l.name AS location_name,
			m.name AS manufacturer_name,
			s.name AS supplier_name,
			v.name AS vendor_name,
			sp.name AS sales_platform_name
			FROM %s i
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
			LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
			LEFT JOIN %s_vendors v ON i.vendor_id = v.id
			LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id`,
			itemsTable, realm, realm, realm, realm, realm)

		var conditions []string
		var args []interface{}

		if search != "" {
			searchPattern := "%" + search + "%"
			conditions = append(conditions, fmt.Sprintf(
				`(i.name LIKE ? OR i.description LIKE ? OR EXISTS (
					SELECT 1 FROM %s ip
					WHERE ip.item_id = i.id AND ip.value LIKE ?
				))`,
				propsTable,
			))
			args = append(args, searchPattern, searchPattern, searchPattern)
		}
		if categoryID != "" {
			conditions = append(conditions, "i.category_id = ?")
			args = append(args, categoryID)
		}
		if locationID != "" {
			locID, err := strconv.Atoi(locationID)
			if err == nil {
				locIDs := getLocationTree(realm, locID)
				locPlaceholders := make([]string, len(locIDs))
				for i, lid := range locIDs {
					locPlaceholders[i] = strconv.Itoa(lid)
				}
				conditions = append(conditions, fmt.Sprintf("i.location_id IN (%s)", strings.Join(locPlaceholders, ",")))
			} else {
				conditions = append(conditions, "i.location_id = ?")
				args = append(args, locationID)
			}
		}
		if status != "" {
			switch status {
			case "active", "reserved", "for_sale", "sold":
				conditions = append(conditions, "i.item_status = ?")
				args = append(args, status)
			case "checked_out":
				conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM %s co WHERE co.item_id = i.id AND co.status = 'active')", checkoutTable))
			}
		}

		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		query += fmt.Sprintf(" ORDER BY %s LIMIT ? OFFSET ?", orderClause)
		args = append(args, perPage, offset)

		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in listItems %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer rows.Close()

		items := make([]map[string]interface{}, 0)
		var itemIDs []interface{}

		for rows.Next() {
			row := map[string]interface{}{}
			if err := rows.MapScan(row); err == nil {
				cleanRow(row)
				items = append(items, row)
				itemIDs = append(itemIDs, row["id"])
			}
		}

		if len(items) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"items":          []interface{}{},
				"total":          0,
				"total_quantity": 0,
				"total_value":    0,
				"page":           page,
				"per_page":       perPage,
			})
			return
		}

		propsByItem := loadListItemProperties(propsTable, propDefsTable, itemIDs)
		attachByItem := loadListItemAttachments(realm, attachTable, itemIDs)
		checkoutByItem := loadListItemCheckouts(checkoutTable, itemIDs)
		applyListItemEnrichment(realm, items, propsByItem, attachByItem, checkoutByItem)

		// Total count
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s i", itemsTable)
		if len(conditions) > 0 {
			countQuery += " WHERE " + strings.Join(conditions, " AND ")
		}
		var total int
		countArgs := args[:len(args)-2] // strip limit/offset
		database.DB.Get(&total, countQuery, countArgs...)

		// Aggregates
		var totalQty int
		var totalValue float64
		aggQuery := fmt.Sprintf("SELECT COALESCE(SUM(quantity),0), COALESCE(SUM(purchase_price*quantity),0) FROM %s", itemsTable)
		if len(conditions) > 0 {
			aggQuery += " WHERE " + strings.Join(conditions, " AND ")
		}
		aggArgs := args[:len(args)-2] // strip limit/offset
		database.DB.QueryRow(aggQuery, aggArgs...).Scan(&totalQty, &totalValue)

		c.JSON(http.StatusOK, gin.H{
			"items":          items,
			"total":          total,
			"total_quantity": totalQty,
			"total_value":    totalValue,
			"page":           page,
			"per_page":       perPage,
		})
	}
}

func getItem(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		row := loadEnrichedItem(realm, id)
		if row == nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func listItemLookup(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"

	return func(c *gin.Context) {
		excludeID := strings.TrimSpace(c.Query("exclude_id"))
		query := fmt.Sprintf(`SELECT i.id, i.name, i.item_status, i.is_bundle,
			pc.parent_item_id,
			pi.name AS parent_item_name
			FROM %s i
			LEFT JOIN %s pc ON pc.child_item_id = i.id
			LEFT JOIN %s pi ON pi.id = pc.parent_item_id`,
			itemsTable, componentsTable, itemsTable,
		)
		args := []interface{}{}
		if excludeID != "" {
			query += " WHERE i.id <> ?"
			args = append(args, excludeID)
		}
		query += " ORDER BY i.name ASC, i.id ASC"

		rows, err := database.DB.Queryx(query, args...)
		if err != nil {
			log.Printf("DB query error in listItemLookup %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer rows.Close()

		items := make([]map[string]interface{}, 0)
		for rows.Next() {
			row := map[string]interface{}{}
			if err := rows.MapScan(row); err == nil {
				cleanRow(row)
				items = append(items, row)
			}
		}
		c.JSON(http.StatusOK, items)
	}
}

func createItem(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"

	return func(c *gin.Context) {
		var body struct {
			Name             string                 `json:"name"`
			Description      *string                `json:"description"`
			CategoryID       *int                   `json:"category_id"`
			LocationID       *int                   `json:"location_id"`
			ItemStatus       *string                `json:"item_status"`
			IsBundle         *bool                  `json:"is_bundle"`
			Quantity         *int                   `json:"quantity"`
			IsConsumable     *bool                  `json:"is_consumable"`
			MinimumQuantity  *int                   `json:"minimum_quantity"`
			ManufacturerID   *int                   `json:"manufacturer_id"`
			SupplierID       *int                   `json:"supplier_id"`
			VendorID         *int                   `json:"vendor_id"`
			PurchaseDate     *string                `json:"purchase_date"`
			PurchasePrice    *float64               `json:"purchase_price"`
			PurchaseCurrency *string                `json:"purchase_currency"`
			SalesPlatformID  *int                   `json:"sales_platform_id"`
			AskingPrice      *float64               `json:"asking_price"`
			SoldPrice        *float64               `json:"sold_price"`
			SoldAt           *string                `json:"sold_at"`
			ComponentItemIDs []int                  `json:"component_item_ids"`
			Properties       map[string]interface{} `json:"properties"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		if body.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Name is required"})
			return
		}

		quantity := 1
		if body.Quantity != nil {
			quantity = *body.Quantity
		}
		isConsumable := false
		if body.IsConsumable != nil {
			isConsumable = *body.IsConsumable
		}
		purchaseCurrency := "EUR"
		if body.PurchaseCurrency != nil && *body.PurchaseCurrency != "" {
			purchaseCurrency = *body.PurchaseCurrency
		}
		itemStatus := "active"
		if body.ItemStatus != nil && *body.ItemStatus != "" {
			itemStatus = *body.ItemStatus
		}
		isBundle := body.IsBundle != nil && *body.IsBundle

		now := database.TimestampNow()
		tx, err := database.DB.Beginx()
		if err != nil {
			log.Printf("DB begin error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer tx.Rollback()

		result, err := tx.Exec(
			fmt.Sprintf(`INSERT INTO %s (name, description, category_id, location_id, item_status, is_bundle, quantity, is_consumable,
				minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price,
				purchase_currency, sales_platform_id, asking_price, sold_price, sold_at, created_at, updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, itemsTable),
			body.Name, body.Description, body.CategoryID, body.LocationID,
			itemStatus, isBundle, quantity, isConsumable, body.MinimumQuantity,
			body.ManufacturerID, body.SupplierID, body.VendorID,
			body.PurchaseDate, body.PurchasePrice, purchaseCurrency,
			body.SalesPlatformID, body.AskingPrice, body.SoldPrice, body.SoldAt,
			now, now,
		)
		if err != nil {
			log.Printf("DB insert error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		// Insert properties (dict format: {property_id_or_name: value})
		if len(body.Properties) > 0 {
			savePropertiesTx(tx, realm, int(newID), body.Properties)
		}
		if err := syncItemComponentsTx(tx, realm, int(newID), isBundle, body.ComponentItemIDs); err != nil {
			var validationErr bundleValidationError
			if errors.As(err, &validationErr) {
				c.JSON(http.StatusBadRequest, gin.H{"detail": validationErr.Error()})
				return
			}
			log.Printf("DB component sync error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("DB commit error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		ws.M.Broadcast("stats."+realm+"_updated", nil)

		// Return enriched item (same as getItem)
		row := loadEnrichedItem(realm, fmt.Sprintf("%d", newID))
		if row == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to load created item"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func updateItem(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"

	return func(c *gin.Context) {
		id := c.Param("id")
		body := map[string]interface{}{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}

		// Only allow known item columns
		allowed := map[string]bool{
			"name": true, "description": true, "category_id": true, "location_id": true,
			"item_status": true, "is_bundle": true,
			"quantity": true, "is_consumable": true, "minimum_quantity": true,
			"manufacturer_id": true, "supplier_id": true, "vendor_id": true,
			"purchase_date": true, "purchase_price": true, "purchase_currency": true,
			"sales_platform_id": true, "asking_price": true, "sold_price": true, "sold_at": true,
		}

		// Extract properties for separate handling
		props, hasProps := body["properties"]
		componentItemIDsValue, hasComponentItemIDs := body["component_item_ids"]
		clean := map[string]interface{}{}
		for k, v := range body {
			if allowed[k] {
				clean[k] = v
			}
		}
		clean["updated_at"] = database.TimestampNow()
		delete(clean, "component_item_ids")

		tx, err := database.DB.Beginx()
		if err != nil {
			log.Printf("DB begin error in updateItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer tx.Rollback()

		sets, vals, err := buildUpdate(clean)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid field name"})
			return
		}
		if sets != "" {
			vals = append(vals, id)
			query := fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", itemsTable, sets)
			if _, err := tx.Exec(query, vals...); err != nil {
				log.Printf("DB update error in updateItem %s: %v", realm, err)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
				return
			}
		}

		// Update properties if provided (dict format: {property_id_or_name: value})
		if hasProps {
			if propsMap, ok := props.(map[string]interface{}); ok {
				itemIDInt, _ := strconv.Atoi(id)
				savePropertiesTx(tx, realm, itemIDInt, propsMap)
			}
		}
		itemIDInt, _ := strconv.Atoi(id)
		if hasComponentItemIDs || body["is_bundle"] != nil {
			componentItemIDs, err := parseComponentItemIDs(componentItemIDsValue)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
				return
			}
			nextIsBundle, err := resolveNextIsBundle(tx, itemsTable, itemIDInt, body["is_bundle"], hasComponentItemIDs, componentItemIDs)
			if err != nil {
				var validationErr bundleValidationError
				if errors.As(err, &validationErr) {
					c.JSON(http.StatusBadRequest, gin.H{"detail": validationErr.Error()})
					return
				}
				log.Printf("DB resolve bundle state error in updateItem %s: %v", realm, err)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
				return
			}
			if !hasComponentItemIDs {
				componentItemIDs, err = loadItemComponentIDsTx(tx, realm, itemIDInt)
				if err != nil {
					log.Printf("DB load components error in updateItem %s: %v", realm, err)
					c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
					return
				}
			}
			if err := syncItemComponentsTx(tx, realm, itemIDInt, nextIsBundle, componentItemIDs); err != nil {
				var validationErr bundleValidationError
				if errors.As(err, &validationErr) {
					c.JSON(http.StatusBadRequest, gin.H{"detail": validationErr.Error()})
					return
				}
				log.Printf("DB component sync error in updateItem %s: %v", realm, err)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
				return
			}
		}
		if err := tx.Commit(); err != nil {
			log.Printf("DB commit error in updateItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		ws.M.Broadcast("stats."+realm+"_updated", nil)

		// Return enriched item (same as getItem)
		row := loadEnrichedItem(realm, id)
		if row == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to load updated item"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func deleteItem(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"

	return func(c *gin.Context) {
		id := c.Param("id")
		tx, err := database.DB.Beginx()
		if err != nil {
			log.Printf("DB begin error in deleteItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE parent_item_id = ?", componentsTable), id); err != nil {
			log.Printf("DB release child items error in deleteItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		result, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", itemsTable), id)
		if err != nil {
			log.Printf("DB delete error in deleteItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("DB commit error in deleteItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		ws.M.Broadcast("stats."+realm+"_updated", nil)
		c.Status(http.StatusNoContent)
	}
}

// ── Attachment Handlers ──

func uploadAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}
		upload, err := storeUploadedFile(c, file, filepath.Join(config.C.UploadDir, realm, itemID), path.Join(realm, itemID))
		if err != nil {
			switch err.Error() {
			case "File too large":
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": err.Error()})
			case "No file provided", "File type not allowed", "File content does not match its extension":
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			}
			return
		}

		attType := c.DefaultPostForm("type", "image")
		order := c.DefaultPostForm("order", "0")
		description := c.PostForm("description")
		gallery := c.DefaultPostForm("gallery", "false") == "true"
		now := database.TimestampNow()

		result, err := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, storage_backend, attachment_type, description, gallery, size, `order`, created_at, updated_at) VALUES (?, ?, ?, 'local', ?, ?, ?, ?, ?, ?, ?)", table),
			itemID, upload.OriginalName, upload.RelativePath, attType, description, gallery, upload.Size, order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		user := middleware.GetUser(c)
		audit(user.ID, "attachment.upload", fmt.Sprintf("realm=%s item=%s file=%s", realm, itemID, upload.OriginalName))

		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func addLinkAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		var body struct {
			URL         string `json:"url"`
			Filename    string `json:"filename"`
			Description string `json:"description"`
			Order       int    `json:"order"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		if err := validateExternalAttachmentURL(body.URL); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			return
		}

		filename := body.Filename
		if filename == "" {
			// Extract filename from URL path
			parts := strings.Split(body.URL, "?")
			urlPath := parts[0]
			if idx := strings.LastIndex(urlPath, "/"); idx >= 0 {
				filename = urlPath[idx+1:]
			}
			if filename == "" {
				filename = body.URL
			}
		}

		attType := detectLinkType(filename, "")
		var fileSize *int64

		now := database.TimestampNow()
		result, err := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, storage_backend, attachment_type, url, description, gallery, size, `order`, created_at, updated_at) VALUES (?, ?, '', 'external_url', ?, ?, ?, 0, ?, ?, ?, ?)", table),
			itemID, filename, attType, body.URL, body.Description, fileSize, body.Order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func addExternalSFTPAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		var body struct {
			ExternalSourceID int    `json:"external_source_id"`
			ExternalPath     string `json:"external_path"`
			Filename         string `json:"filename"`
			Description      string `json:"description"`
			Order            int    `json:"order"`
			Gallery          bool   `json:"gallery"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}
		if body.ExternalSourceID < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "external_source_id is required"})
			return
		}

		src, err := loadExternalSource(body.ExternalSourceID)
		if err != nil || !src.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "External source is not available"})
			return
		}

		externalPath, err := storage.ResolveSFTPPath(src.BasePath, body.ExternalPath)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid external_path"})
			return
		}

		filename := strings.TrimSpace(body.Filename)
		if filename == "" {
			filename = path.Base(externalPath)
		}
		if filename == "." || filename == "/" || filename == "" {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Filename could not be derived from external_path"})
			return
		}

		attType := detectLinkType(filename, "")
		now := database.TimestampNow()
		result, err := database.DB.Exec(
			fmt.Sprintf(`INSERT INTO %s (
				item_id, filename, file_path, storage_backend, external_source_id, external_path, attachment_type,
				url, description, gallery, size, `+"`order`"+`, created_at, updated_at
			) VALUES (?, ?, '', 'external_sftp', ?, ?, ?, '', ?, ?, NULL, ?, ?, ?)`, table),
			itemID, filename, body.ExternalSourceID, externalPath, attType, body.Description, body.Gallery, body.Order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, err := result.LastInsertId()
		if err != nil {
			log.Printf("DB last insert id error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		row, err := loadAttachmentRow(realm, table, newID)
		if err != nil {
			log.Printf("DB read error in addExternalSFTPAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func updateAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
			return
		}

		allowed := map[string]bool{"description": true, "order": true, "attachment_type": true, "url": true, "gallery": true}
		sets := ""
		var vals []interface{}
		for k, v := range body {
			if !allowed[k] {
				continue
			}
			if k == "url" {
				urlValue, ok := v.(string)
				if !ok {
					c.JSON(http.StatusBadRequest, gin.H{"detail": "Attachment URL must be a string"})
					return
				}
				if err := validateExternalAttachmentURL(urlValue); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
					return
				}
			}
			if sets != "" {
				sets += ", "
			}
			sets += fmt.Sprintf("`%s` = ?", k)
			vals = append(vals, v)
		}
		if sets == "" {
			row, err := loadAttachmentRow(realm, table, attID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
				return
			}
			c.JSON(http.StatusOK, row)
			return
		}
		sets += ", updated_at = ?"
		vals = append(vals, database.TimestampNow(), attID)

		result, err := database.DB.Exec(fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, sets), vals...)
		if err != nil {
			log.Printf("DB update error in updateAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}

		row, err := loadAttachmentRow(realm, table, attID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func validateExternalAttachmentURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("Attachment URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("Invalid attachment URL")
	}
	if parsed.Host == "" || !parsed.IsAbs() {
		return fmt.Errorf("Attachment URL must be absolute")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("Attachment URL must use http or https")
	}
	return nil
}

func deleteAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")

		// Get local file path before deleting
		var filePath string
		var storageBackend string
		database.DB.Get(&filePath, fmt.Sprintf("SELECT COALESCE(file_path, '') FROM %s WHERE id = ?", table), attID)
		database.DB.Get(&storageBackend, fmt.Sprintf("SELECT COALESCE(storage_backend, 'local') FROM %s WHERE id = ?", table), attID)

		result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", table), attID)
		if err != nil {
			log.Printf("DB delete error in deleteAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}

		if storageBackend == "local" && filePath != "" {
			if _, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, filePath); err == nil {
				_ = os.Remove(fullPath)
			}
		}

		user := middleware.GetUser(c)
		audit(user.ID, "attachment.delete", fmt.Sprintf("realm=%s att=%s", realm, attID))

		c.Status(http.StatusNoContent)
	}
}

func getAttachmentContent(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")

		var att struct {
			ID               int     `db:"id"`
			Filename         string  `db:"filename"`
			FilePath         *string `db:"file_path"`
			StorageBackend   *string `db:"storage_backend"`
			URL              *string `db:"url"`
			ExternalSourceID *int    `db:"external_source_id"`
			ExternalPath     *string `db:"external_path"`
		}
		if err := database.DB.Get(&att, fmt.Sprintf("SELECT id, filename, file_path, storage_backend, url, external_source_id, external_path FROM %s WHERE id = ?", table), attID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment not found"})
			return
		}

		backend := "local"
		if att.StorageBackend != nil && strings.TrimSpace(*att.StorageBackend) != "" {
			backend = strings.TrimSpace(*att.StorageBackend)
		}

		switch backend {
		case "local":
			if att.FilePath == nil || strings.TrimSpace(*att.FilePath) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment file not found"})
				return
			}
			_, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, *att.FilePath)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment file not found"})
				return
			}
			serveAttachmentFile(c, att.Filename, fullPath)
			return
		case "external_url":
			if att.URL == nil || strings.TrimSpace(*att.URL) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Attachment URL not found"})
				return
			}
			c.Redirect(http.StatusTemporaryRedirect, strings.TrimSpace(*att.URL))
			return
		case "external_sftp":
			if att.ExternalSourceID == nil || att.ExternalPath == nil || strings.TrimSpace(*att.ExternalPath) == "" {
				c.JSON(http.StatusNotFound, gin.H{"detail": "External attachment is incomplete"})
				return
			}
			src, err := loadExternalSource(*att.ExternalSourceID)
			if err != nil || !src.IsActive {
				c.JSON(http.StatusBadGateway, gin.H{"detail": "External source is unavailable"})
				return
			}
			stream, err := storage.OpenSFTPFileStream(context.Background(), storage.SFTPSourceConfig{
				Host:         src.Host,
				Port:         src.Port,
				Username:     src.Username,
				AuthType:     src.AuthType,
				Password:     stringValue(src.Password),
				PrivateKey:   stringValue(src.PrivateKey),
				KnownHostKey: src.KnownHostKey,
				BasePath:     src.BasePath,
			}, *att.ExternalPath)
			if err != nil {
				log.Printf("SFTP stream error for attachment %s: %v", attID, err)
				c.JSON(http.StatusBadGateway, gin.H{"detail": describeSFTPAttachmentError(err)})
				return
			}
			defer stream.Close()

			setAttachmentHeaders(c, att.Filename)
			if stream.Size >= 0 {
				c.Header("Content-Length", strconv.FormatInt(stream.Size, 10))
			}
			contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(att.Filename)))
			if contentType == "" {
				contentType = "application/octet-stream"
			}
			c.DataFromReader(http.StatusOK, stream.Size, contentType, stream, nil)
			return
		default:
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Unsupported attachment backend"})
			return
		}
	}
}

func uploadPropertyFile(realm string) gin.HandlerFunc {
	propsTable := realm + "_item_properties"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")
		propID := c.Param("propId")

		if !itemExists(itemsTable, itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}
		upload, err := storeUploadedFile(c, file, filepath.Join(config.C.UploadDir, realm, itemID, "props"), path.Join(realm, itemID, "props"))
		if err != nil {
			switch err.Error() {
			case "File too large":
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": err.Error()})
			case "No file provided", "File type not allowed", "File content does not match its extension":
				c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
			}
			return
		}
		valueMap := map[string]interface{}{
			"type":         "file",
			"filename":     upload.OriginalName,
			"path":         upload.RelativePath,
			"size":         upload.Size,
			"content_type": upload.ContentType,
		}
		valueBytes, _ := json.Marshal(valueMap)
		value := string(valueBytes)

		// Upsert
		var existingID int
		err = database.DB.Get(&existingID, fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if err == nil {
			database.DB.Exec(fmt.Sprintf("UPDATE %s SET value = ?, updated_at = ? WHERE id = ?", propsTable), value, database.TimestampNow(), existingID)
		} else {
			database.DB.Exec(fmt.Sprintf("INSERT INTO %s (item_id, property_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", propsTable),
				itemID, propID, value, database.TimestampNow(), database.TimestampNow())
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok", "value": valueMap})
	}
}

// resolvePropertyID resolves a property key (numeric ID string or property name) to an integer property ID.
// Returns the resolved ID and true if found, or 0 and false if not found.
func resolvePropertyID(realm string, key string) (int, bool) {
	// Try parsing as integer first
	if id, err := strconv.Atoi(key); err == nil {
		return id, true
	}
	// Look up by name in {realm}_properties
	propDefsTable := realm + "_properties"
	var id int
	err := database.DB.Get(&id, fmt.Sprintf("SELECT id FROM %s WHERE name = ?", propDefsTable), key)
	if err == nil {
		return id, true
	}
	return 0, false
}

// saveProperties upserts item properties from a dict {property_id_or_name: value}.
func saveProperties(realm string, itemID int, properties map[string]interface{}) {
	savePropertiesTx(database.DB, realm, itemID, properties)
}

func savePropertiesTx(exec sqlx.Ext, realm string, itemID int, properties map[string]interface{}) {
	propsTable := realm + "_item_properties"

	for key, val := range properties {
		propID, ok := resolvePropertyID(realm, key)
		if !ok {
			continue
		}

		// Strip client-side markers (keys starting with "_") from dict values
		if valMap, isMap := val.(map[string]interface{}); isMap {
			cleaned := map[string]interface{}{}
			for k, v := range valMap {
				if !strings.HasPrefix(k, "_") {
					cleaned[k] = v
				}
			}
			val = cleaned
		}

		valJSON, _ := json.Marshal(val)

		var existingID int
		existErr := sqlx.Get(exec, &existingID,
			fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if existErr == nil {
			exec.Exec(
				fmt.Sprintf("UPDATE %s SET value = ? WHERE id = ?", propsTable),
				string(valJSON), existingID)
		} else {
			exec.Exec(
				fmt.Sprintf("INSERT INTO %s (item_id, property_id, value) VALUES (?, ?, ?)", propsTable),
				itemID, propID, string(valJSON))
		}
	}
}

type bundleValidationError string

func (e bundleValidationError) Error() string {
	return string(e)
}

func parseComponentItemIDs(value interface{}) ([]int, error) {
	if value == nil {
		return nil, nil
	}
	values, ok := value.([]interface{})
	if !ok {
		return nil, bundleValidationError("component_item_ids must be an array")
	}
	parsed := make([]int, 0, len(values))
	for _, entry := range values {
		switch v := entry.(type) {
		case float64:
			parsed = append(parsed, int(v))
		case int:
			parsed = append(parsed, v)
		default:
			return nil, bundleValidationError("component_item_ids contains an invalid item id")
		}
	}
	return parsed, nil
}

func resolveNextIsBundle(tx *sqlx.Tx, itemsTable string, itemID int, rawIsBundle interface{}, hasComponentItemIDs bool, componentItemIDs []int) (bool, error) {
	if rawIsBundle != nil {
		switch value := rawIsBundle.(type) {
		case bool:
			if hasComponentItemIDs && len(componentItemIDs) > 0 {
				return true, nil
			}
			return value, nil
		case float64:
			if value == 0 || value == 1 {
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return value == 1, nil
			}
		case int:
			if value == 0 || value == 1 {
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return value == 1, nil
			}
		case string:
			normalized := strings.TrimSpace(strings.ToLower(value))
			switch normalized {
			case "true", "1":
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return true, nil
			case "false", "0", "":
				if hasComponentItemIDs && len(componentItemIDs) > 0 {
					return true, nil
				}
				return false, nil
			}
		}
		return false, bundleValidationError("is_bundle must be a boolean")
	}
	if hasComponentItemIDs {
		return len(componentItemIDs) > 0, nil
	}
	var current bool
	if err := tx.Get(&current, fmt.Sprintf("SELECT COALESCE(is_bundle, 0) FROM %s WHERE id = ?", itemsTable), itemID); err != nil {
		return false, err
	}
	return current, nil
}

func loadItemComponentIDsTx(tx *sqlx.Tx, realm string, itemID int) ([]int, error) {
	componentsTable := realm + "_item_components"
	rows, err := tx.Queryx(fmt.Sprintf("SELECT child_item_id FROM %s WHERE parent_item_id = ? ORDER BY position ASC, id ASC", componentsTable), itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	componentIDs := []int{}
	for rows.Next() {
		var childID int
		if err := rows.Scan(&childID); err != nil {
			return nil, err
		}
		componentIDs = append(componentIDs, childID)
	}
	return componentIDs, rows.Err()
}

func syncItemComponentsTx(tx *sqlx.Tx, realm string, parentItemID int, isBundle bool, componentItemIDs []int) error {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"

	componentIDs := make([]int, 0, len(componentItemIDs))
	seen := map[int]bool{}
	for _, childID := range componentItemIDs {
		if childID < 1 {
			return bundleValidationError("Bestandteile enthalten eine ungültige Item-ID")
		}
		if childID == parentItemID {
			return bundleValidationError("Ein Item kann nicht Teil von sich selbst sein")
		}
		if seen[childID] {
			continue
		}
		seen[childID] = true
		componentIDs = append(componentIDs, childID)
	}

	if isBundle {
		var parentOwnerCount int
		if err := tx.Get(&parentOwnerCount, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE child_item_id = ?", componentsTable), parentItemID); err != nil {
			return err
		}
		if parentOwnerCount > 0 {
			return bundleValidationError("Ein Bundle kann nicht gleichzeitig Teil eines anderen Items sein")
		}
	}

	for _, childID := range componentIDs {
		var child struct {
			ID       int  `db:"id"`
			IsBundle bool `db:"is_bundle"`
		}
		if err := tx.Get(&child, fmt.Sprintf("SELECT id, COALESCE(is_bundle, 0) AS is_bundle FROM %s WHERE id = ?", itemsTable), childID); err != nil {
			return bundleValidationError("Ein ausgewähltes Bestandteil-Item wurde nicht gefunden")
		}
		if child.IsBundle {
			return bundleValidationError("Bundles können nicht als Bestandteil eines anderen Items verwendet werden")
		}

		var assignedParentID int
		err := tx.Get(&assignedParentID, fmt.Sprintf("SELECT parent_item_id FROM %s WHERE child_item_id = ? LIMIT 1", componentsTable), childID)
		if err == nil && assignedParentID != parentItemID {
			return bundleValidationError("Mindestens ein Bestandteil gehört bereits zu einem anderen Item")
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) && !strings.Contains(strings.ToLower(err.Error()), "no rows") {
			return err
		}
	}

	if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE parent_item_id = ?", componentsTable), parentItemID); err != nil {
		return err
	}
	now := database.TimestampNow()
	for position, childID := range componentIDs {
		if _, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (parent_item_id, child_item_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", componentsTable),
			parentItemID, childID, position, now, now,
		); err != nil {
			return err
		}
	}

	targetBundleState := isBundle || len(componentIDs) > 0
	if _, err := tx.Exec(fmt.Sprintf("UPDATE %s SET is_bundle = ?, updated_at = ? WHERE id = ?", itemsTable), targetBundleState, now, parentItemID); err != nil {
		return err
	}
	return nil
}

func inClausePlaceholders(ids []interface{}) string {
	if len(ids) == 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
}

func loadListItemProperties(propsTable, propDefsTable string, itemIDs []interface{}) map[interface{}][]map[string]interface{} {
	propsByItem := map[interface{}][]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return propsByItem
	}

	propQuery := fmt.Sprintf(
		`SELECT ip.item_id, ip.property_id, ip.value, pd.name AS property_name, pd.property_type, pd.display_width, pd.unit AS property_unit
		FROM %s ip
		JOIN %s pd ON ip.property_id = pd.id
		WHERE ip.item_id IN (%s)`,
		propsTable, propDefsTable, inClausePlaceholders(itemIDs))

	propRows, err := database.DB.Queryx(propQuery, itemIDs...)
	if err != nil {
		return propsByItem
	}
	defer propRows.Close()

	for propRows.Next() {
		pr := map[string]interface{}{}
		if propRows.MapScan(pr) == nil {
			cleanRow(pr)
			itemID := pr["item_id"]
			propsByItem[itemID] = append(propsByItem[itemID], pr)
		}
	}
	return propsByItem
}

func loadListItemAttachments(realm, attachTable string, itemIDs []interface{}) map[interface{}][]map[string]interface{} {
	attachByItem := map[interface{}][]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return attachByItem
	}

	attachQuery := fmt.Sprintf(
		`SELECT * FROM %s WHERE item_id IN (%s) ORDER BY `+"`order`"+``,
		attachTable, inClausePlaceholders(itemIDs))

	attachRows, err := database.DB.Queryx(attachQuery, itemIDs...)
	if err != nil {
		return attachByItem
	}
	defer attachRows.Close()

	for attachRows.Next() {
		ar := map[string]interface{}{}
		if attachRows.MapScan(ar) == nil {
			cleanRow(ar)
			finalizeAttachmentRow(realm, ar)
			itemID := ar["item_id"]
			attachByItem[itemID] = append(attachByItem[itemID], ar)
		}
	}
	return attachByItem
}

func loadListItemCheckouts(checkoutTable string, itemIDs []interface{}) map[interface{}]map[string]interface{} {
	checkoutByItem := map[interface{}]map[string]interface{}{}
	if len(itemIDs) == 0 {
		return checkoutByItem
	}

	coQuery := fmt.Sprintf(
		`SELECT co.id, co.item_id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
		FROM %s co
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.item_id IN (%s) AND co.status = 'active'`,
		checkoutTable, inClausePlaceholders(itemIDs))

	coRows, err := database.DB.Queryx(coQuery, itemIDs...)
	if err != nil {
		return checkoutByItem
	}
	defer coRows.Close()

	for coRows.Next() {
		cr := map[string]interface{}{}
		if coRows.MapScan(cr) == nil {
			cleanRow(cr)
			itemID := cr["item_id"]
			entry := map[string]interface{}{
				"user_id":     cr["user_id"],
				"user_name":   cr["user_name"],
				"due_date":    cr["due_date"],
				"checkout_id": cr["id"],
				"since":       cr["created_at"],
			}
			if existing, ok := checkoutByItem[itemID]; ok {
				users, _ := existing["users"].([]map[string]interface{})
				existing["users"] = append(users, entry)
				existing["checkout_count"] = len(existing["users"].([]map[string]interface{}))
				continue
			}
			checkoutByItem[itemID] = map[string]interface{}{
				"user_id":        cr["user_id"],
				"user_name":      cr["user_name"],
				"due_date":       cr["due_date"],
				"checkout_id":    cr["id"],
				"since":          cr["created_at"],
				"users":          []map[string]interface{}{entry},
				"checkout_count": 1,
			}
		}
	}
	return checkoutByItem
}

func applyListItemEnrichment(realm string, items []map[string]interface{}, propsByItem map[interface{}][]map[string]interface{}, attachByItem map[interface{}][]map[string]interface{}, checkoutByItem map[interface{}]map[string]interface{}) {
	for _, item := range items {
		id := item["id"]
		if props, ok := propsByItem[id]; ok {
			byID := map[string]interface{}{}
			byName := map[string]interface{}{}
			for _, p := range props {
				propID := fmt.Sprintf("%v", p["property_id"])
				propName, _ := p["property_name"].(string)
				val := parseJSONValue(p["value"])
				byID[propID] = val
				if propName != "" {
					byName[propName] = formatWithUnit(val, p["property_unit"])
				}
			}
			item["properties"] = byID
			item["properties_display"] = byName
		} else {
			item["properties"] = map[string]interface{}{}
			item["properties_display"] = map[string]interface{}{}
		}
		if att, ok := attachByItem[id]; ok {
			item["attachments"] = att
		} else {
			item["attachments"] = []interface{}{}
		}
		if co, ok := checkoutByItem[id]; ok {
			item["checked_out_to"] = co
		} else {
			item["checked_out_to"] = nil
		}
		enrichVendorInfo(realm, item)
	}
}

func loadItemProperties(propsTable, propDefsTable, itemID string) (map[string]interface{}, map[string]interface{}) {
	propQuery := fmt.Sprintf(
		`SELECT ip.id, ip.property_id, ip.value, pd.name AS property_name, pd.property_type, pd.display_width, pd.unit AS property_unit
		FROM %s ip
		JOIN %s pd ON ip.property_id = pd.id
		WHERE ip.item_id = ?`, propsTable, propDefsTable)

	var props []map[string]interface{}
	propRows, err := database.DB.Queryx(propQuery, itemID)
	if err == nil {
		defer propRows.Close()
		for propRows.Next() {
			pr := map[string]interface{}{}
			if propRows.MapScan(pr) == nil {
				cleanRow(pr)
				props = append(props, pr)
			}
		}
	}

	byID := map[string]interface{}{}
	byName := map[string]interface{}{}
	for _, p := range props {
		pID := fmt.Sprintf("%v", p["property_id"])
		pName, _ := p["property_name"].(string)
		val := parseJSONValue(p["value"])
		byID[pID] = val
		if pName != "" {
			byName[pName] = formatWithUnit(val, p["property_unit"])
		}
	}
	return byID, byName
}

func loadItemAttachments(realm, attachTable, itemID string) []map[string]interface{} {
	var attachments []map[string]interface{}
	attachRows, err := database.DB.Queryx(
		fmt.Sprintf(`SELECT * FROM %s WHERE item_id = ? ORDER BY `+"`order`"+``, attachTable), itemID)
	if err == nil {
		defer attachRows.Close()
		for attachRows.Next() {
			ar := map[string]interface{}{}
			if attachRows.MapScan(ar) == nil {
				cleanRow(ar)
				finalizeAttachmentRow(realm, ar)
				attachments = append(attachments, ar)
			}
		}
	}
	if attachments == nil {
		attachments = []map[string]interface{}{}
	}
	return attachments
}

func loadItemCheckoutInfo(realm, checkoutTable, itemID string) interface{} {
	query := fmt.Sprintf(
		`SELECT co.id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
		FROM %s co
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.item_id = ? AND co.status = 'active'
		ORDER BY co.created_at ASC, co.id ASC`, checkoutTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	users := make([]map[string]interface{}, 0)
	var first map[string]interface{}
	for rows.Next() {
		entry := map[string]interface{}{}
		if rows.MapScan(entry) == nil {
			cleanRow(entry)
			userEntry := map[string]interface{}{
				"user_id":     entry["user_id"],
				"user_name":   entry["user_name"],
				"due_date":    entry["due_date"],
				"checkout_id": entry["id"],
				"since":       entry["created_at"],
			}
			if first == nil {
				first = userEntry
			}
			users = append(users, userEntry)
		}
	}
	if len(users) == 0 {
		return nil
	}

	componentIDs, componentNames := loadActiveCheckoutComponents(realm, checkoutTable, itemID)
	return gin.H{
		"user_id":         first["user_id"],
		"user_name":       first["user_name"],
		"due_date":        first["due_date"],
		"checkout_id":     first["checkout_id"],
		"since":           first["since"],
		"users":           users,
		"checkout_count":  len(users),
		"component_ids":   componentIDs,
		"component_names": componentNames,
	}
}

func loadActiveCheckoutComponents(realm, checkoutTable, itemID string) ([]int, []string) {
	itemsTable := realm + "_items"
	query := fmt.Sprintf(`SELECT co.item_id, i.name
		FROM %s co
		JOIN %s i ON i.id = co.item_id
		WHERE co.bundle_parent_item_id = ? AND co.status = 'active'
		ORDER BY i.name ASC`, checkoutTable, itemsTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return []int{}, []string{}
	}
	defer rows.Close()

	componentIDs := []int{}
	componentNames := []string{}
	for rows.Next() {
		var componentID int
		var componentName string
		if err := rows.Scan(&componentID, &componentName); err == nil {
			componentIDs = append(componentIDs, componentID)
			componentNames = append(componentNames, componentName)
		}
	}
	return componentIDs, componentNames
}

func loadItemComponents(realm, itemID string) []map[string]interface{} {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"
	query := fmt.Sprintf(`SELECT i.id, i.name, i.item_status, i.is_bundle, ic.position
		FROM %s ic
		JOIN %s i ON i.id = ic.child_item_id
		WHERE ic.parent_item_id = ?
		ORDER BY ic.position ASC, i.name ASC`, componentsTable, itemsTable)
	rows, err := database.DB.Queryx(query, itemID)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	components := []map[string]interface{}{}
	for rows.Next() {
		row := map[string]interface{}{}
		if rows.MapScan(row) == nil {
			cleanRow(row)
			components = append(components, row)
		}
	}
	return components
}

func loadParentBundle(realm, itemID string) map[string]interface{} {
	itemsTable := realm + "_items"
	componentsTable := realm + "_item_components"
	query := fmt.Sprintf(`SELECT p.id, p.name, p.item_status, p.is_bundle
		FROM %s ic
		JOIN %s p ON p.id = ic.parent_item_id
		WHERE ic.child_item_id = ?
		LIMIT 1`, componentsTable, itemsTable)
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(query, itemID).MapScan(row); err != nil {
		return nil
	}
	cleanRow(row)
	return row
}

// loadEnrichedItem loads an item with all enrichment (properties, attachments, checkout, vendor info)
// matching the same response format as getItem.
func loadEnrichedItem(realm string, itemID string) map[string]interface{} {
	itemsTable := realm + "_items"
	propsTable := realm + "_item_properties"
	propDefsTable := realm + "_properties"
	attachTable := realm + "_attachments"
	checkoutTable := realm + "_checkouts"

	query := fmt.Sprintf(`SELECT i.*,
		c.name AS category_name,
		l.name AS location_name,
		m.name AS manufacturer_name,
		s.name AS supplier_name,
		v.name AS vendor_name,
		sp.name AS sales_platform_name
		FROM %s i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
		LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
		LEFT JOIN %s_vendors v ON i.vendor_id = v.id
		LEFT JOIN generic_sales_platforms sp ON i.sales_platform_id = sp.id
		WHERE i.id = ?`, itemsTable, realm, realm, realm, realm, realm)

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx(query, itemID)
	if err := sqlRow.MapScan(row); err != nil {
		return nil
	}
	cleanRow(row)

	byID, byName := loadItemProperties(propsTable, propDefsTable, itemID)
	row["properties"] = byID
	row["properties_display"] = byName

	row["attachments"] = loadItemAttachments(realm, attachTable, itemID)
	row["checked_out_to"] = loadItemCheckoutInfo(realm, checkoutTable, itemID)
	row["components"] = loadItemComponents(realm, itemID)
	row["component_item_ids"] = componentIDsFromRows(row["components"].([]map[string]interface{}))
	row["parent_bundle"] = loadParentBundle(realm, itemID)

	// Enrich vendor info
	enrichVendorInfo(realm, row)

	return row
}

func componentIDsFromRows(rows []map[string]interface{}) []int {
	ids := make([]int, 0, len(rows))
	for _, row := range rows {
		switch id := row["id"].(type) {
		case int:
			ids = append(ids, id)
		case int64:
			ids = append(ids, int(id))
		case float64:
			ids = append(ids, int(id))
		}
	}
	return ids
}

// formatWithUnit returns {value: ..., unit: "..."} if unit is set, otherwise {value: ...}.
func formatWithUnit(val interface{}, unitRaw interface{}) interface{} {
	entry := map[string]interface{}{"value": val}
	if unitRaw == nil {
		return entry
	}
	unit := ""
	switch u := unitRaw.(type) {
	case string:
		unit = u
	case []byte:
		unit = string(u)
	}
	if unit != "" {
		entry["unit"] = unit
	}
	return entry
}

func safeFilename(name string) string {
	// Take basename only
	if i := strings.LastIndex(name, "/"); i >= 0 {
		name = name[i+1:]
	}
	if i := strings.LastIndex(name, "\\"); i >= 0 {
		name = name[i+1:]
	}
	name = strings.TrimLeft(name, ".")
	if name == "" {
		name = "upload"
	}
	return name
}

type storedUpload struct {
	OriginalName string
	StorageName  string
	RelativePath string
	FullPath     string
	Extension    string
	Size         int64
	ContentType  string
}

func storeUploadedFile(c *gin.Context, file *multipart.FileHeader, destinationDir, relativeDir string) (*storedUpload, error) {
	if file == nil {
		return nil, fmt.Errorf("No file provided")
	}
	if file.Size > config.C.MaxUploadSize {
		return nil, fmt.Errorf("File too large")
	}
	if !isAllowedExtension(file.Filename) {
		return nil, fmt.Errorf("File type not allowed")
	}

	ext := strings.ToLower(path.Ext(file.Filename))
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("Failed to read file")
	}
	magicBuf := make([]byte, 512)
	n, _ := io.ReadAtLeast(src, magicBuf, 1)
	src.Close()
	if n > 0 {
		if err := validateMagicBytes(magicBuf[:n], ext); err != nil {
			return nil, fmt.Errorf("File content does not match its extension")
		}
	}

	originalName := safeFilename(file.Filename)
	storageName := uuid.New().String() + ext
	fullPath := filepath.Join(destinationDir, storageName)
	if err := os.MkdirAll(destinationDir, 0755); err != nil {
		return nil, fmt.Errorf("Upload failed")
	}
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		return nil, fmt.Errorf("Upload failed")
	}

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return &storedUpload{
		OriginalName: originalName,
		StorageName:  storageName,
		RelativePath: path.Join(relativeDir, storageName),
		FullPath:     fullPath,
		Extension:    ext,
		Size:         file.Size,
		ContentType:  contentType,
	}, nil
}

func itemExists(itemsTable, itemID string) bool {
	var exists int
	return database.DB.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", itemsTable), itemID) == nil && exists > 0
}

func loadAttachmentRow(realm, table string, attachmentID interface{}) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	if err := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), attachmentID).MapScan(row); err != nil {
		return nil, err
	}
	cleanRow(row)
	finalizeAttachmentRow(realm, row)
	return row, nil
}

func finalizeAttachmentRow(realm string, row map[string]interface{}) {
	id := fmt.Sprintf("%v", row["id"])
	backend := strings.TrimSpace(fmt.Sprintf("%v", row["storage_backend"]))
	if backend == "" || backend == "<nil>" {
		if urlValue, ok := row["url"].(string); ok && strings.TrimSpace(urlValue) != "" {
			backend = "external_url"
		} else {
			backend = "local"
		}
		row["storage_backend"] = backend
	}
	row["download_url"] = fmt.Sprintf("/api/%s/attachments/%s/content", realm, id)
}

func serveAttachmentFile(c *gin.Context, filename, fullPath string) {
	setAttachmentHeaders(c, filename)
	c.File(fullPath)
}

func setAttachmentHeaders(c *gin.Context, filename string) {
	ext := strings.ToLower(filepath.Ext(filename))
	inlineTypes := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true, ".bmp": true, ".heic": true,
		".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
		".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true, ".aac": true,
		".pdf": true,
	}

	if inlineTypes[ext] {
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	} else {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	}
	c.Header("X-Content-Type-Options", "nosniff")
}

func stringValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func describeSFTPAttachmentError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "no such file"), strings.Contains(msg, "file does not exist"), strings.Contains(msg, "not exist"):
		return "SFTP file not found"
	case strings.Contains(msg, "unable to authenticate"), strings.Contains(msg, "permission denied"), strings.Contains(msg, "missing sftp password"), strings.Contains(msg, "missing sftp private key"):
		return "SFTP authentication failed"
	case strings.Contains(msg, "known_host_key"), strings.Contains(msg, "host key"), strings.Contains(msg, "mismatch"):
		return "SFTP host key mismatch"
	case strings.Contains(msg, "dial sftp source"):
		return "SFTP server not reachable"
	case strings.Contains(msg, "handshake sftp source"):
		return "SFTP handshake failed"
	case strings.Contains(msg, "invalid sftp attachment path"), strings.Contains(msg, "escapes base path"), strings.Contains(msg, "empty sftp attachment path"):
		return "Invalid SFTP path"
	default:
		return "Could not read external attachment"
	}
}

// getLocationTree recursively finds a location and all its descendants.
func getLocationTree(realm string, locationID int) []int {
	table := realm + "_locations"
	result := []int{locationID}

	// Load all locations and build parent->children map
	type locRow struct {
		ID       int  `db:"id"`
		ParentID *int `db:"parent_id"`
	}
	var allLocs []locRow
	err := database.DB.Select(&allLocs, fmt.Sprintf("SELECT id, parent_id FROM %s", table))
	if err != nil {
		return result
	}

	childrenMap := map[int][]int{}
	for _, loc := range allLocs {
		if loc.ParentID != nil {
			childrenMap[*loc.ParentID] = append(childrenMap[*loc.ParentID], loc.ID)
		}
	}

	queue := []int{locationID}
	for len(queue) > 0 {
		parent := queue[0]
		queue = queue[1:]
		for _, childID := range childrenMap[parent] {
			result = append(result, childID)
			queue = append(queue, childID)
		}
	}
	return result
}

// enrichVendorInfo loads full vendor details (website, email, phone, type-specific fields)
// and adds *_info maps to the item dict.
func enrichVendorInfo(realm string, item map[string]interface{}) {
	loadVendor := func(table string, vendorID interface{}) map[string]interface{} {
		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), vendorID)
		if err := sqlRow.MapScan(row); err != nil {
			return nil
		}
		cleanRow(row)
		return row
	}

	if mfrID := item["manufacturer_id"]; mfrID != nil && mfrID != int64(0) && mfrID != float64(0) {
		if mfr := loadVendor(realm+"_manufacturers", mfrID); mfr != nil {
			item["manufacturer_info"] = map[string]interface{}{
				"website":       mfr["website"],
				"email":         mfr["email"],
				"phone":         mfr["phone"],
				"support_email": mfr["support_email"],
				"support_phone": mfr["support_phone"],
				"support_url":   mfr["support_url"],
			}
		}
	}
	if supID := item["supplier_id"]; supID != nil && supID != int64(0) && supID != float64(0) {
		if sup := loadVendor(realm+"_suppliers", supID); sup != nil {
			item["supplier_info"] = map[string]interface{}{
				"website":         sup["website"],
				"email":           sup["email"],
				"phone":           sup["phone"],
				"contact_person":  sup["contact_person"],
				"account_manager": sup["account_manager"],
			}
		}
	}
	if venID := item["vendor_id"]; venID != nil && venID != int64(0) && venID != float64(0) {
		if ven := loadVendor(realm+"_vendors", venID); ven != nil {
			item["vendor_info"] = map[string]interface{}{
				"website":         ven["website"],
				"email":           ven["email"],
				"phone":           ven["phone"],
				"contact_person":  ven["contact_person"],
				"customer_number": ven["customer_number"],
			}
		}
	}
}

// allowedExtensions is the set of file extensions permitted for upload.
var allowedExtensions = map[string]bool{
	// Images
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	".svg": true, ".bmp": true, ".heic": true, ".heif": true, ".avif": true,
	".tiff": true, ".tif": true,
	// Documents
	".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	".ppt": true, ".pptx": true, ".odt": true, ".ods": true, ".odp": true,
	".rtf": true, ".csv": true, ".tsv": true,
	// Archives
	".zip": true, ".tar": true, ".gz": true, ".tgz": true, ".bz2": true,
	".7z": true, ".rar": true, ".iso": true, ".dmg": true, ".img": true,
	// Audio
	".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true,
	".aac": true, ".wma": true, ".opus": true, ".aiff": true, ".mid": true, ".midi": true,
	// Video
	".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
	".flv": true, ".wmv": true, ".m4v": true, ".mpg": true, ".mpeg": true, ".m3u8": true,
	// Code/Text
	".txt": true, ".log": true, ".md": true, ".json": true, ".xml": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".cfg": true,
	".conf": true, ".py": true, ".js": true, ".ts": true,
	".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true,
	".java": true, ".swift": true, ".sql": true, ".html": true, ".css": true,
	".sh": true, ".bat": true,
}

// isAllowedExtension checks if a filename has an allowed extension.
func isAllowedExtension(filename string) bool {
	ext := strings.ToLower(path.Ext(filename))
	return allowedExtensions[ext]
}

// textExtensions are extensions that should be validated as UTF-8 content.
var textExtensions = map[string]bool{
	".txt": true, ".log": true, ".md": true, ".json": true, ".xml": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".cfg": true,
	".conf": true, ".py": true, ".js": true, ".ts": true,
	".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true,
	".java": true, ".swift": true, ".sql": true, ".html": true, ".css": true,
	".sh": true, ".bat": true, ".csv": true, ".tsv": true, ".rtf": true,
	".svg": true,
}

// validateMagicBytes checks that the first bytes of a file match the claimed extension.
// Returns an error if content does not match.
func validateMagicBytes(header []byte, ext string) error {
	ext = strings.ToLower(ext)
	n := len(header)

	switch ext {
	case ".jpg", ".jpeg":
		if n < 3 || header[0] != 0xFF || header[1] != 0xD8 || header[2] != 0xFF {
			return fmt.Errorf("file content does not match JPEG format")
		}
	case ".png":
		if n < 4 || header[0] != 0x89 || header[1] != 0x50 || header[2] != 0x4E || header[3] != 0x47 {
			return fmt.Errorf("file content does not match PNG format")
		}
	case ".gif":
		if n < 4 || header[0] != 0x47 || header[1] != 0x49 || header[2] != 0x46 || header[3] != 0x38 {
			return fmt.Errorf("file content does not match GIF format")
		}
	case ".pdf":
		if n < 4 || header[0] != 0x25 || header[1] != 0x50 || header[2] != 0x44 || header[3] != 0x46 {
			return fmt.Errorf("file content does not match PDF format")
		}
	case ".zip", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp":
		if n < 2 || header[0] != 0x50 || header[1] != 0x4B {
			return fmt.Errorf("file content does not match ZIP/Office format")
		}
	default:
		// For text/code files, verify valid UTF-8
		if textExtensions[ext] {
			if !utf8.Valid(header) {
				return fmt.Errorf("file content is not valid UTF-8 for text file type %s", ext)
			}
		}
		// For other binary formats (video, audio, etc.) we allow them through
		// as magic byte detection for all formats would be excessive.
	}
	return nil
}

// detectLinkType determines the attachment type from filename extension or content-type.
func detectLinkType(filename string, contentType string) string {
	ext := strings.ToLower(path.Ext(filename))
	ct := strings.ToLower(contentType)

	imageExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true, ".bmp": true, ".heic": true}
	videoExts := map[string]bool{".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true, ".m3u8": true}
	audioExts := map[string]bool{".mp3": true, ".wav": true, ".flac": true, ".ogg": true, ".m4a": true, ".aac": true}
	archiveExts := map[string]bool{".zip": true, ".tar": true, ".gz": true, ".rar": true, ".7z": true, ".iso": true, ".dmg": true, ".img": true}
	documentExts := map[string]bool{".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true, ".ppt": true, ".pptx": true, ".odt": true}
	codeExts := map[string]bool{".py": true, ".js": true, ".ts": true, ".go": true, ".rs": true, ".c": true, ".cpp": true, ".h": true, ".sh": true, ".json": true, ".yaml": true, ".xml": true}

	if imageExts[ext] {
		return "image"
	}
	if videoExts[ext] {
		return "video"
	}
	if audioExts[ext] {
		return "audio"
	}
	if archiveExts[ext] {
		return "archive"
	}
	if documentExts[ext] {
		return "document"
	}
	if codeExts[ext] {
		return "code"
	}

	// Fallback to content-type
	if strings.Contains(ct, "image") {
		return "image"
	}
	if strings.Contains(ct, "video") {
		return "video"
	}
	if strings.Contains(ct, "audio") {
		return "audio"
	}
	if strings.Contains(ct, "pdf") || strings.Contains(ct, "document") {
		return "document"
	}

	return "link"
}
