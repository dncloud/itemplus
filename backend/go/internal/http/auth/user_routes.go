package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func RegisterUserRoutes(api *gin.RouterGroup) {
	api.GET("/user", middleware.AuthAllowInactive(), getMe)
	api.PUT("/user", middleware.Auth(), updateMe)
	api.DELETE("/user", middleware.Auth(), deleteMe)
	api.POST("/user/avatar", middleware.Auth(), uploadMyAvatar)
	api.DELETE("/user/avatar", middleware.Auth(), deleteMyAvatar)
	api.GET("/user/sidebar-favorites", middleware.Auth(), getSidebarFavorites)
	api.PUT("/user/sidebar-favorites", middleware.Auth(), updateSidebarFavorites)

	api.GET("/users", middleware.Auth(), middleware.RequireAdmin(), listUsers)
	api.GET("/users/lookup", middleware.Auth(), lookupUser)
	api.GET("/users/inactive", middleware.Auth(), middleware.RequireAdmin(), listInactiveUsers)
	api.GET("/users/:id", middleware.Auth(), middleware.RequireAdmin(), getUser)
	api.PUT("/users/:id", middleware.Auth(), middleware.RequireAdmin(), updateUser)
	api.PUT("/users/:id/activate", middleware.Auth(), middleware.RequireAdmin(), activateUser)
	api.DELETE("/users/:id", middleware.Auth(), middleware.RequireAdmin(), deleteUser)
}
