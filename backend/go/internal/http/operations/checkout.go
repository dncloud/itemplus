package operations

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterCheckoutRoutes(api *gin.RouterGroup) {
	// Direct checkout/checkin
	api.POST("/checkout/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkoutItem)
	api.POST("/checkin/:realm/:item_id", middleware.Auth(), middleware.RequirePermission("checkout.manage"), checkinItem)
	// A borrower cannot close a loan, only say that the item is back; the
	// return counts once someone who manages loans confirms it with a checkin.
	api.POST("/checkouts/:realm/:id/return-request", middleware.Auth(), requestCheckoutReturn)
	api.DELETE("/checkouts/:realm/:id/return-request", middleware.Auth(), middleware.RequirePermission("checkout.manage"), dismissCheckoutReturnRequest)
	api.PUT("/checkout/:realm/:id", middleware.Auth(), middleware.RequireAdmin(), updateCheckout)
	api.POST("/checkouts/:realm/:id/remind", middleware.Auth(), middleware.RequirePermission("checkout.manage"), remindCheckout)

	// Checkout lists
	api.GET("/checkouts/:realm/active", middleware.Auth(), listActiveCheckouts)
	api.GET("/checkouts/:realm/history", middleware.Auth(), listCheckoutHistory)
	api.GET("/checkouts/my/overdue", middleware.Auth(), listMyOverdueCheckouts)
	api.GET("/checkouts/overdue", middleware.Auth(), middleware.RequirePermission("checkout.manage"), listOverdueCheckouts)
	api.GET("/checkouts/return-requests", middleware.Auth(), middleware.RequirePermission("checkout.manage"), listCheckoutReturnRequests)

	// Checkout requests
	api.POST("/checkout/request", middleware.Auth(), createCheckoutRequest)
	api.GET("/checkout/requests", middleware.Auth(), listCheckoutRequests)
	api.PUT("/checkout/requests/:id/approve", middleware.Auth(), middleware.RequirePermission("checkout.manage"), approveCheckoutRequest)
	api.PUT("/checkout/requests/:id/reject", middleware.Auth(), middleware.RequirePermission("checkout.manage"), rejectCheckoutRequest)
}
