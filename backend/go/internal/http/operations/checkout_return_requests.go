package operations

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
	ws "github.com/itemplus/backend/internal/websocket"
)

// requestCheckoutReturn records that the borrower says the item is back.
// Nothing else changes: the loan stays active, the item stays lent, and no
// stock movement is written until a manager confirms the return.
func requestCheckoutReturn(c *gin.Context) {
	realm := c.Param("realm")
	if !ensureCheckoutRealm(c, realm) {
		return
	}
	table := realm + "_checkouts"
	user := middleware.GetUser(c)

	var loan struct {
		BorrowerID int     `db:"user_id"`
		ItemID     int     `db:"item_id"`
		ReportedAt *string `db:"return_requested_at"`
	}
	err := database.DB.Get(&loan,
		fmt.Sprintf("SELECT user_id, item_id, return_requested_at FROM %s WHERE id = ? AND status = 'active' AND bundle_parent_item_id IS NULL", table), c.Param("id"))
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No active checkout found"})
		return
	}
	if err != nil {
		log.Printf("DB checkout lookup error in requestCheckoutReturn: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if loan.BorrowerID != user.ID && !user.HasPermission("checkout.manage") {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Only your own checkouts can be reported as returned", "code": "checkout_not_yours"})
		return
	}

	now := database.TimestampNow()
	// Reporting twice keeps the first time.
	if _, err := database.DB.Exec(
		fmt.Sprintf("UPDATE %s SET return_requested_at = COALESCE(return_requested_at, ?), updated_at = ? WHERE id = ?", table),
		now, now, c.Param("id"),
	); err != nil {
		log.Printf("DB update error in requestCheckoutReturn: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	middleware.Audit(user.ID, "checkout.return_requested", fmt.Sprintf("realm=%s checkout=%s", realm, c.Param("id")))
	// Reporting again does not ask the managers again.
	if loan.ReportedAt == nil {
		notify(loanManagers(user.ID), notifyLoanReturnReported, loanFacts(realm, loan.ItemID, loan.BorrowerID), loansLink(realm))
	}
	ws.M.Broadcast("stats."+realm+"_updated", nil)
	c.JSON(http.StatusOK, gin.H{"status": "return_requested", "checkout_id": c.Param("id")})
}

// dismissCheckoutReturnRequest is the manager's "it is not back": the report
// is removed and the loan goes on as before.
func dismissCheckoutReturnRequest(c *gin.Context) {
	realm := c.Param("realm")
	if !ensureCheckoutRealm(c, realm) {
		return
	}
	var loan struct {
		BorrowerID int `db:"user_id"`
		ItemID     int `db:"item_id"`
	}
	_ = database.DB.Get(&loan, fmt.Sprintf("SELECT user_id, item_id FROM %s_checkouts WHERE id = ?", realm), c.Param("id"))
	result, err := database.DB.Exec(
		fmt.Sprintf("UPDATE %s_checkouts SET return_requested_at = NULL, updated_at = ? WHERE id = ? AND status = 'active' AND return_requested_at IS NOT NULL", realm),
		database.TimestampNow(), c.Param("id"),
	)
	if err != nil {
		log.Printf("DB update error in dismissCheckoutReturnRequest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No return report found"})
		return
	}
	user := middleware.GetUser(c)
	middleware.Audit(user.ID, "checkout.return_request_dismissed", fmt.Sprintf("realm=%s checkout=%s", realm, c.Param("id")))
	if loan.BorrowerID > 0 && loan.BorrowerID != user.ID {
		notify([]int{loan.BorrowerID}, notifyLoanReturnDismissed, loanFacts(realm, loan.ItemID, 0), loansLink(realm))
	}
	ws.M.Broadcast("stats."+realm+"_updated", nil)
	c.JSON(http.StatusOK, gin.H{"status": "active", "checkout_id": c.Param("id")})
}

// listCheckoutReturnRequests lists, for both realms, the loans whose
// borrower says the item is back and that wait for confirmation.
func listCheckoutReturnRequests(c *gin.Context) {
	result := []map[string]interface{}{}
	for _, realm := range []string{"archive", "collection"} {
		query := fmt.Sprintf(
			`SELECT co.*, i.name AS item_name, COALESCE(u.display_name, u.email) AS user_name, '%[1]s' AS realm
			FROM %[1]s_checkouts co
			LEFT JOIN %[1]s_items i ON co.item_id = i.id
			LEFT JOIN users u ON co.user_id = u.id
			WHERE co.status = 'active' AND co.return_requested_at IS NOT NULL AND co.bundle_parent_item_id IS NULL
			ORDER BY co.return_requested_at`, realm)
		rows, err := loadCheckoutRows(query, realm)
		if err != nil {
			log.Printf("DB query error in listCheckoutReturnRequests: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Internal server error"})
			return
		}
		result = append(result, rows...)
	}
	c.JSON(http.StatusOK, result)
}
