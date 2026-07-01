package operations

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterCheckoutRoutes(api *gin.RouterGroup) {
	// Direct checkout/checkin
	api.POST("/checkout/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkoutItem)
	api.POST("/checkin/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkinItem)
	api.PUT("/checkout/:realm/:id", middleware.Auth(), middleware.RequireAdmin(), updateCheckout)

	// Checkout lists
	api.GET("/checkouts/:realm/active", middleware.Auth(), listActiveCheckouts)
	api.GET("/checkouts/:realm/history", middleware.Auth(), listCheckoutHistory)
	api.GET("/checkouts/my/overdue", middleware.Auth(), listMyOverdueCheckouts)
	api.GET("/checkouts/overdue", middleware.Auth(), middleware.RequirePermission("checkout.manage"), listOverdueCheckouts)

	// Checkout requests
	api.POST("/checkout/request", middleware.Auth(), createCheckoutRequest)
	api.GET("/checkout/requests", middleware.Auth(), listCheckoutRequests)
	api.PUT("/checkout/requests/:id/approve", middleware.Auth(), middleware.RequirePermission("checkout.manage"), approveCheckoutRequest)
	api.PUT("/checkout/requests/:id/reject", middleware.Auth(), middleware.RequirePermission("checkout.manage"), rejectCheckoutRequest)
}
