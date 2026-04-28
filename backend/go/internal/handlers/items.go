package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path"
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
)

func RegisterItemRoutes(g *gin.RouterGroup, realm string) {
	uploadRL := middleware.RateLimit(20, time.Minute)
	searchRL := middleware.RateLimit(30, time.Minute)

	g.GET("", middleware.Auth(), middleware.RequirePermission("items.read"), searchRL, listItems(realm))
	g.GET("/:id", middleware.Auth(), middleware.RequirePermission("items.read"), getItem(realm))
	g.POST("", middleware.Auth(), middleware.RequirePermission("items.write"), createItem(realm))
	g.PUT("/:id", middleware.Auth(), middleware.RequirePermission("items.write"), updateItem(realm))
	g.DELETE("/:id", middleware.Auth(), middleware.RequirePermission("items.delete"), deleteItem(realm))

	// Attachments
	g.POST("/:id/attachments", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadAttachment(realm))
	g.POST("/:id/attachments/link", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), addLinkAttachment(realm))

	// Property file upload
	g.POST("/:id/properties/:propId/upload", middleware.Auth(), middleware.RequireAllPermissions("attachments.write", "items.read"), uploadRL, uploadPropertyFile(realm))
}

func RegisterAttachmentRoutes(g *gin.RouterGroup, realm string) {
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
		sortField := c.DefaultQuery("sort", "updated")
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
			"name": "i.name", "price": "i.purchase_price", "quantity": "i.quantity",
			"created": "i.created_at", "updated": "i.updated_at",
		}
		sortCol := "i.updated_at"
		if col, ok := sortMap[sortField]; ok {
			sortCol = col
		}
		if sortOrder != "asc" {
			sortOrder = "desc"
		}

		// Build query
		query := fmt.Sprintf(`SELECT i.*,
			c.name AS category_name,
			l.name AS location_name,
			m.name AS manufacturer_name,
			s.name AS supplier_name,
			v.name AS vendor_name
			FROM %s i
			LEFT JOIN %s_categories c ON i.category_id = c.id
			LEFT JOIN %s_locations l ON i.location_id = l.id
			LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
			LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
			LEFT JOIN %s_vendors v ON i.vendor_id = v.id`,
			itemsTable, realm, realm, realm, realm, realm)

		var conditions []string
		var args []interface{}

		if search != "" {
			searchPattern := "%" + search + "%"
			// Also search in property values
			propSearchQuery := fmt.Sprintf(
				`SELECT DISTINCT item_id FROM %s WHERE CAST(value AS TEXT) LIKE ?`,
				propsTable)
			propRows, err := database.DB.Queryx(propSearchQuery, searchPattern)
			var propItemIDs []string
			if err == nil {
				defer propRows.Close()
				for propRows.Next() {
					var pid int
					if propRows.Scan(&pid) == nil {
						propItemIDs = append(propItemIDs, strconv.Itoa(pid))
					}
				}
			}
			if len(propItemIDs) > 0 {
				conditions = append(conditions, fmt.Sprintf("(i.name LIKE ? OR i.description LIKE ? OR i.id IN (%s))", strings.Join(propItemIDs, ",")))
				args = append(args, searchPattern, searchPattern)
			} else {
				conditions = append(conditions, "(i.name LIKE ? OR i.description LIKE ?)")
				args = append(args, searchPattern, searchPattern)
			}
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

		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		query += fmt.Sprintf(" ORDER BY %s %s LIMIT ? OFFSET ?", sortCol, sortOrder)
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

		// Batch-load properties for all items
		propsByItem := map[interface{}][]map[string]interface{}{}
		if len(itemIDs) > 0 {
			placeholders := strings.Repeat("?,", len(itemIDs))
			placeholders = placeholders[:len(placeholders)-1]

			propQuery := fmt.Sprintf(
				`SELECT ip.item_id, ip.property_id, ip.value, pd.name AS property_name, pd.property_type, pd.display_width, pd.unit AS property_unit
				FROM %s ip
				JOIN %s pd ON ip.property_id = pd.id
				WHERE ip.item_id IN (%s)`,
				propsTable, propDefsTable, placeholders)

			propRows, err := database.DB.Queryx(propQuery, itemIDs...)
			if err == nil {
				defer propRows.Close()
				for propRows.Next() {
					pr := map[string]interface{}{}
					if propRows.MapScan(pr) == nil {
						cleanRow(pr)
						itemID := pr["item_id"]
						propsByItem[itemID] = append(propsByItem[itemID], pr)
					}
				}
			}
		}

		// Batch-load attachments
		attachByItem := map[interface{}][]map[string]interface{}{}
		if len(itemIDs) > 0 {
			placeholders := strings.Repeat("?,", len(itemIDs))
			placeholders = placeholders[:len(placeholders)-1]

			attachQuery := fmt.Sprintf(
				`SELECT * FROM %s WHERE item_id IN (%s) ORDER BY "order"`,
				attachTable, placeholders)

			attachRows, err := database.DB.Queryx(attachQuery, itemIDs...)
			if err == nil {
				defer attachRows.Close()
				for attachRows.Next() {
					ar := map[string]interface{}{}
					if attachRows.MapScan(ar) == nil {
						cleanRow(ar)
						itemID := ar["item_id"]
						attachByItem[itemID] = append(attachByItem[itemID], ar)
					}
				}
			}
		}

		// Batch-load active checkouts
		checkoutByItem := map[interface{}]map[string]interface{}{}
		if len(itemIDs) > 0 {
			placeholders := strings.Repeat("?,", len(itemIDs))
			placeholders = placeholders[:len(placeholders)-1]

			coQuery := fmt.Sprintf(
				`SELECT co.id, co.item_id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
				FROM %s co
				LEFT JOIN users u ON co.user_id = u.id
				WHERE co.item_id IN (%s) AND co.status = 'active'`,
				checkoutTable, placeholders)

			coRows, err := database.DB.Queryx(coQuery, itemIDs...)
			if err == nil {
				defer coRows.Close()
				for coRows.Next() {
					cr := map[string]interface{}{}
					if coRows.MapScan(cr) == nil {
						cleanRow(cr)
						itemID := cr["item_id"]
						checkoutByItem[itemID] = map[string]interface{}{
							"user_id":     cr["user_id"],
							"user_name":   cr["user_name"],
							"due_date":    cr["due_date"],
							"checkout_id": cr["id"],
							"since":       cr["created_at"],
						}
					}
				}
			}
		}

		// Enrich items
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
			// Enrich vendor info
			enrichVendorInfo(realm, item)
		}

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

func createItem(realm string) gin.HandlerFunc {
	itemsTable := realm + "_items"

	return func(c *gin.Context) {
		var body struct {
			Name             string                 `json:"name"`
			Description      *string                `json:"description"`
			CategoryID       *int                   `json:"category_id"`
			LocationID       *int                   `json:"location_id"`
			Quantity         *int                   `json:"quantity"`
			IsConsumable     *bool                  `json:"is_consumable"`
			MinimumQuantity  *int                   `json:"minimum_quantity"`
			ManufacturerID   *int                   `json:"manufacturer_id"`
			SupplierID       *int                   `json:"supplier_id"`
			VendorID         *int                   `json:"vendor_id"`
			PurchaseDate     *string                `json:"purchase_date"`
			PurchasePrice    *float64               `json:"purchase_price"`
			PurchaseCurrency *string                `json:"purchase_currency"`
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

		now := time.Now().UTC().Format(time.RFC3339)
		result, err := database.DB.Exec(
			fmt.Sprintf(`INSERT INTO %s (name, description, category_id, location_id, quantity, is_consumable,
				minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price,
				purchase_currency, created_at, updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, itemsTable),
			body.Name, body.Description, body.CategoryID, body.LocationID,
			quantity, isConsumable, body.MinimumQuantity,
			body.ManufacturerID, body.SupplierID, body.VendorID,
			body.PurchaseDate, body.PurchasePrice, purchaseCurrency,
			now, now,
		)
		if err != nil {
			log.Printf("DB insert error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		newID, _ := result.LastInsertId()

		// Insert properties (dict format: {property_id_or_name: value})
		if len(body.Properties) > 0 {
			saveProperties(realm, int(newID), body.Properties)
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
			"quantity": true, "is_consumable": true, "minimum_quantity": true,
			"manufacturer_id": true, "supplier_id": true, "vendor_id": true,
			"purchase_date": true, "purchase_price": true, "purchase_currency": true,
		}

		// Extract properties for separate handling
		props, hasProps := body["properties"]
		clean := map[string]interface{}{}
		for k, v := range body {
			if allowed[k] {
				clean[k] = v
			}
		}
		clean["updated_at"] = time.Now().UTC().Format(time.RFC3339)

		sets, vals := buildUpdate(clean)
		vals = append(vals, id)
		query := fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", itemsTable, sets)
		_, err := database.DB.Exec(query, vals...)
		if err != nil {
			log.Printf("DB update error in updateItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}

		// Update properties if provided (dict format: {property_id_or_name: value})
		if hasProps {
			if propsMap, ok := props.(map[string]interface{}); ok {
				itemIDInt, _ := strconv.Atoi(id)
				saveProperties(realm, itemIDInt, propsMap)
			}
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

	return func(c *gin.Context) {
		id := c.Param("id")
		result, err := database.DB.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", itemsTable), id)
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

		// Verify item exists
		var exists int
		if err := database.DB.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", itemsTable), itemID); err != nil || exists == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}

		// Enforce max file size
		if file.Size > config.C.MaxUploadSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": "File too large"})
			return
		}

		// Allowlist check
		if !isAllowedExtension(file.Filename) {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "File type not allowed"})
			return
		}

		// Magic byte validation
		ext := strings.ToLower(path.Ext(file.Filename))
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to read file"})
			return
		}
		magicBuf := make([]byte, 512)
		n, _ := io.ReadAtLeast(src, magicBuf, 1)
		src.Close()
		if n > 0 {
			if err := validateMagicBytes(magicBuf[:n], ext); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "File content does not match its extension"})
				return
			}
		}

		// Generate neutral storage name
		originalName := safeFilename(file.Filename)
		storageName := uuid.New().String() + ext
		uploadDir := fmt.Sprintf("%s/%s/%s", config.C.UploadDir, realm, itemID)
		os.MkdirAll(uploadDir, 0755)
		dst := uploadDir + "/" + storageName

		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Upload failed"})
			return
		}

		attType := c.DefaultPostForm("type", "image")
		order := c.DefaultPostForm("order", "0")
		description := c.PostForm("description")
		gallery := c.DefaultPostForm("gallery", "false") == "true"
		filePath := fmt.Sprintf("%s/%s/%s", realm, itemID, storageName)
		now := time.Now().UTC().Format(time.RFC3339)

		result, _ := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, attachment_type, description, gallery, size, \"order\", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", table),
			itemID, originalName, filePath, attType, description, gallery, file.Size, order, now, now,
		)
		newID, _ := result.LastInsertId()

		user := middleware.GetUser(c)
		audit(user.ID, "attachment.upload", fmt.Sprintf("realm=%s item=%s file=%s", realm, itemID, originalName))

		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), newID)
		if err := sqlRow.MapScan(row); err != nil {
			log.Printf("DB read error in uploadAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		cleanRow(row)
		c.JSON(http.StatusCreated, row)
	}
}

func addLinkAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")

		var exists int
		if err := database.DB.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", itemsTable), itemID); err != nil || exists == 0 {
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

		now := time.Now().UTC().Format(time.RFC3339)
		result, err := database.DB.Exec(
			fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, attachment_type, url, description, gallery, size, \"order\", created_at, updated_at) VALUES (?, ?, '', ?, ?, ?, 0, ?, ?, ?, ?)", table),
			itemID, filename, attType, body.URL, body.Description, fileSize, body.Order, now, now,
		)
		if err != nil {
			log.Printf("DB insert error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		newID, _ := result.LastInsertId()

		row := map[string]interface{}{}
		sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), newID)
		if err := sqlRow.MapScan(row); err != nil {
			log.Printf("DB read error in addLinkAttachment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		cleanRow(row)
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
			if sets != "" {
				sets += ", "
			}
			sets += fmt.Sprintf("\"%s\" = ?", k)
			vals = append(vals, v)
		}
		if sets == "" {
			row := map[string]interface{}{}
			sqlRow := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), attID)
			if err := sqlRow.MapScan(row); err != nil {
				c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
				return
			}
			cleanRow(row)
			c.JSON(http.StatusOK, row)
			return
		}
		sets += ", updated_at = ?"
		vals = append(vals, time.Now().UTC().Format(time.RFC3339), attID)

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

		row := map[string]interface{}{}
		if err := database.DB.QueryRowx(fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table), attID).MapScan(row); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Not found"})
			return
		}
		cleanRow(row)
		c.JSON(http.StatusOK, row)
	}
}

func deleteAttachment(realm string) gin.HandlerFunc {
	table := realm + "_attachments"
	return func(c *gin.Context) {
		attID := c.Param("attId")

		// Get file path before deleting
		var filePath string
		database.DB.Get(&filePath, fmt.Sprintf("SELECT COALESCE(file_path, '') FROM %s WHERE id = ?", table), attID)

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

		if filePath != "" {
			if _, fullPath, err := storage.ResolveUploadPath(config.C.UploadDir, filePath); err == nil {
				_ = os.Remove(fullPath)
			}
		}

		user := middleware.GetUser(c)
		audit(user.ID, "attachment.delete", fmt.Sprintf("realm=%s att=%s", realm, attID))

		c.Status(http.StatusNoContent)
	}
}

func uploadPropertyFile(realm string) gin.HandlerFunc {
	propsTable := realm + "_item_properties"
	itemsTable := realm + "_items"
	return func(c *gin.Context) {
		itemID := c.Param("id")
		propID := c.Param("propId")

		var exists int
		if err := database.DB.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", itemsTable), itemID); err != nil || exists == 0 {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}

		file, err := c.FormFile("file")
		if err != nil || file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "No file provided"})
			return
		}

		// Enforce max file size
		if file.Size > config.C.MaxUploadSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"detail": "File too large"})
			return
		}

		// Allowlist check
		if !isAllowedExtension(file.Filename) {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "File type not allowed"})
			return
		}

		// Magic byte validation
		ext := strings.ToLower(path.Ext(file.Filename))
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to read file"})
			return
		}
		magicBuf := make([]byte, 512)
		n, _ := io.ReadAtLeast(src, magicBuf, 1)
		src.Close()
		if n > 0 {
			if err := validateMagicBytes(magicBuf[:n], ext); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"detail": "File content does not match its extension"})
				return
			}
		}

		// Generate neutral storage name
		originalName := safeFilename(file.Filename)
		storageName := uuid.New().String() + ext
		uploadDir := fmt.Sprintf("%s/%s/%s/props", config.C.UploadDir, realm, itemID)
		os.MkdirAll(uploadDir, 0755)
		dst := uploadDir + "/" + storageName

		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Upload failed"})
			return
		}

		relPath := fmt.Sprintf("%s/%s/props/%s", realm, itemID, storageName)
		contentType := file.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		valueMap := map[string]interface{}{
			"type":         "file",
			"filename":     originalName,
			"path":         relPath,
			"size":         file.Size,
			"content_type": contentType,
		}
		valueBytes, _ := json.Marshal(valueMap)
		value := string(valueBytes)

		// Upsert
		var existingID int
		err = database.DB.Get(&existingID, fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if err == nil {
			database.DB.Exec(fmt.Sprintf("UPDATE %s SET value = ?, updated_at = ? WHERE id = ?", propsTable), value, time.Now().UTC().Format(time.RFC3339), existingID)
		} else {
			database.DB.Exec(fmt.Sprintf("INSERT INTO %s (item_id, property_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", propsTable),
				itemID, propID, value, time.Now().UTC().Format(time.RFC3339), time.Now().UTC().Format(time.RFC3339))
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
		existErr := database.DB.Get(&existingID,
			fmt.Sprintf("SELECT id FROM %s WHERE item_id = ? AND property_id = ?", propsTable), itemID, propID)
		if existErr == nil {
			database.DB.Exec(
				fmt.Sprintf("UPDATE %s SET value = ? WHERE id = ?", propsTable),
				string(valJSON), existingID)
		} else {
			database.DB.Exec(
				fmt.Sprintf("INSERT INTO %s (item_id, property_id, value) VALUES (?, ?, ?)", propsTable),
				itemID, propID, string(valJSON))
		}
	}
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
		v.name AS vendor_name
		FROM %s i
		LEFT JOIN %s_categories c ON i.category_id = c.id
		LEFT JOIN %s_locations l ON i.location_id = l.id
		LEFT JOIN %s_manufacturers m ON i.manufacturer_id = m.id
		LEFT JOIN %s_suppliers s ON i.supplier_id = s.id
		LEFT JOIN %s_vendors v ON i.vendor_id = v.id
		WHERE i.id = ?`, itemsTable, realm, realm, realm, realm, realm)

	row := map[string]interface{}{}
	sqlRow := database.DB.QueryRowx(query, itemID)
	if err := sqlRow.MapScan(row); err != nil {
		return nil
	}
	cleanRow(row)

	// Properties
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
	row["properties"] = byID
	row["properties_display"] = byName

	// Attachments
	var attachments []map[string]interface{}
	attachRows, err := database.DB.Queryx(
		fmt.Sprintf(`SELECT * FROM %s WHERE item_id = ? ORDER BY "order"`, attachTable), itemID)
	if err == nil {
		defer attachRows.Close()
		for attachRows.Next() {
			ar := map[string]interface{}{}
			if attachRows.MapScan(ar) == nil {
				cleanRow(ar)
				attachments = append(attachments, ar)
			}
		}
	}
	if attachments == nil {
		attachments = []map[string]interface{}{}
	}
	row["attachments"] = attachments

	// Checked out to
	var coUserID int
	var coUserName, coDueDate, coSince *string
	var coID int
	coQuery := fmt.Sprintf(
		`SELECT co.id, co.user_id, COALESCE(u.display_name, u.email) AS user_name, co.due_date, co.created_at
		FROM %s co
		LEFT JOIN users u ON co.user_id = u.id
		WHERE co.item_id = ? AND co.status = 'active' LIMIT 1`, checkoutTable)
	if database.DB.QueryRow(coQuery, itemID).Scan(&coID, &coUserID, &coUserName, &coDueDate, &coSince) == nil {
		row["checked_out_to"] = gin.H{
			"user_id":     coUserID,
			"user_name":   coUserName,
			"due_date":    coDueDate,
			"checkout_id": coID,
			"since":       coSince,
		}
	} else {
		row["checked_out_to"] = nil
	}

	// Enrich vendor info
	enrichVendorInfo(realm, row)

	return row
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
	".conf": true, ".env": true, ".py": true, ".js": true, ".ts": true,
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
	".conf": true, ".env": true, ".py": true, ".js": true, ".ts": true,
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
