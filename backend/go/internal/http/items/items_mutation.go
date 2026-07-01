package items

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	itemscore "github.com/itemplus/backend/internal/core/items"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

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

		if len(body.Properties) > 0 {
			savePropertiesTx(tx, realm, int(newID), body.Properties)
		}
		user := middleware.GetUser(c)
		var createdBy interface{}
		if user != nil {
			createdBy = user.ID
		}
		if err := itemscore.RecordInventoryMovementTx(tx, realm, newID, "created", 0, quantity, nil, "item", nil, createdBy, now); err != nil {
			log.Printf("DB inventory movement insert error in createItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
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

		includeMaintenance := user != nil && user.HasPermission("maintenance.read")
		includeInventory := user != nil && user.HasPermission("inventory.read")
		row := loadEnrichedItem(realm, fmt.Sprintf("%d", newID), includeMaintenance, includeInventory)
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

		allowed := map[string]bool{
			"name": true, "description": true, "category_id": true, "location_id": true,
			"item_status": true, "is_bundle": true,
			"quantity": true, "is_consumable": true, "minimum_quantity": true,
			"manufacturer_id": true, "supplier_id": true, "vendor_id": true,
			"purchase_date": true, "purchase_price": true, "purchase_currency": true,
			"sales_platform_id": true, "asking_price": true, "sold_price": true, "sold_at": true,
		}

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
		_, quantityWillChange := clean["quantity"]

		tx, err := database.DB.Beginx()
		if err != nil {
			log.Printf("DB begin error in updateItem %s: %v", realm, err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		defer tx.Rollback()

		var previousQuantity int
		if quantityWillChange {
			previousQuantity, err = itemscore.LoadItemQuantityTx(tx, realm, id)
			if err != nil {
				log.Printf("DB load quantity error in updateItem %s: %v", realm, err)
				c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
				return
			}
		}

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

		if hasProps {
			if propsMap, ok := props.(map[string]interface{}); ok {
				itemIDInt, _ := strconv.Atoi(id)
				savePropertiesTx(tx, realm, itemIDInt, propsMap)
			}
		}
		if quantityWillChange {
			nextQuantity := middleware.AsInt(clean["quantity"])
			if nextQuantity != previousQuantity {
				user := middleware.GetUser(c)
				var createdBy interface{}
				if user != nil {
					createdBy = user.ID
				}
				if err := itemscore.RecordInventoryMovementTx(tx, realm, id, itemscore.MovementTypeForQuantityChange(previousQuantity, nextQuantity), previousQuantity, nextQuantity, nil, "manual", nil, createdBy, database.TimestampNow()); err != nil {
					log.Printf("DB inventory movement insert error in updateItem %s: %v", realm, err)
					c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
					return
				}
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

		user := middleware.GetUser(c)
		includeMaintenance := user != nil && user.HasPermission("maintenance.read")
		includeInventory := user != nil && user.HasPermission("inventory.read")
		row := loadEnrichedItem(realm, id, includeMaintenance, includeInventory)
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
