package operations

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
)

const inventoryCheckoutAffectsMovementQuantitySettingKey = "inventory.checkout_affects_movement_quantity"

type inventorySettingsPayload struct {
	CheckoutAffectsMovementQuantity bool `json:"checkout_affects_movement_quantity"`
}

func adminGetInventorySettings(c *gin.Context) {
	c.JSON(http.StatusOK, currentInventorySettings())
}

func adminUpdateInventorySettings(c *gin.Context) {
	var payload inventorySettingsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid body"})
		return
	}
	if err := database.UpsertAppSetting(
		inventoryCheckoutAffectsMovementQuantitySettingKey,
		strconv.FormatBool(payload.CheckoutAffectsMovementQuantity),
		database.TimestampNow(),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Could not save inventory settings"})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func currentInventorySettings() inventorySettingsPayload {
	return inventorySettingsPayload{
		CheckoutAffectsMovementQuantity: inventoryCheckoutAffectsMovementQuantity(),
	}
}

func inventoryCheckoutAffectsMovementQuantity() bool {
	var raw string
	if err := database.DB.Get(&raw, "SELECT value FROM app_settings WHERE `key` = ?", inventoryCheckoutAffectsMovementQuantitySettingKey); err != nil {
		return false
	}
	value, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	return value
}

func checkoutMovementQuantities(totalQuantity int, movementType string) (int, int) {
	if !inventoryCheckoutAffectsMovementQuantity() {
		return totalQuantity, totalQuantity
	}

	switch movementType {
	case "checked_out":
		if totalQuantity <= 0 {
			return 0, 0
		}
		return totalQuantity, totalQuantity - 1
	case "returned":
		if totalQuantity <= 0 {
			return 0, 0
		}
		return totalQuantity - 1, totalQuantity
	default:
		return totalQuantity, totalQuantity
	}
}
