package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/http/middleware"
)

func wsTicketGenerate(c *gin.Context) {
	user := middleware.GetUser(c)

	ticket, err := randomURLToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Ticket could not be created"})
		return
	}

	wsTicketsMu.Lock()
	wsTickets[ticket] = &wsTicket{
		UserID: user.ID,
		Expiry: time.Now().Add(30 * time.Second),
	}
	wsTicketsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"ticket": ticket})
}
