package operations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

type inbox struct {
	Items []struct {
		ID     int                    `json:"id"`
		Kind   string                 `json:"kind"`
		Data   map[string]interface{} `json:"data"`
		Link   string                 `json:"link"`
		ReadAt *string                `json:"read_at"`
	} `json:"items"`
	Unread int `json:"unread"`
}

func readInbox(t *testing.T, user *middleware.User) inbox {
	t.Helper()
	rec := serve(listNotifications, user, nil, nil)
	var result inbox
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("inbox of %d: status %d, err %v: %s", user.ID, rec.Code, err, rec.Body.String())
	}
	return result
}

func kinds(box inbox) []string {
	result := []string{}
	for _, item := range box.Items {
		result = append(result, item.Kind)
	}
	return result
}

// Everyone involved in a loan hears about the steps the others take, and
// nobody about their own.
func TestLoanStepsNotifyTheOtherSide(t *testing.T) {
	admin := useSQLite(t)
	anna := addBorrower(t, "anna@example.de")
	ben := addBorrower(t, "ben@example.de")
	mustExec(t, `UPDATE users SET permissions = '["checkout.manage"]' WHERE id = ?`, ben.ID)

	// Anna asks: both managers are told, Anna is not.
	rec := serve(createCheckoutRequest, anna, nil, map[string]interface{}{"realm": "archive", "item_id": 1, "requested_duration_days": 7})
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("request: status %d: %s", rec.Code, rec.Body.String())
	}
	for _, manager := range []*middleware.User{admin, ben} {
		box := readInbox(t, manager)
		if len(box.Items) != 1 || box.Items[0].Kind != notifyLoanRequested || box.Unread != 1 {
			t.Fatalf("manager %d inbox = %v, want one unread loan request", manager.ID, kinds(box))
		}
		if box.Items[0].Data["item"] != "Bohrmaschine" || box.Items[0].Data["user"] != "anna@example.de" || box.Items[0].Link != "/checkouts?realm=archive&filter=pending" {
			t.Fatalf("loan request says %v, link %q", box.Items[0].Data, box.Items[0].Link)
		}
	}
	if box := readInbox(t, anna); len(box.Items) != 0 {
		t.Fatalf("the requester was told about her own request: %v", kinds(box))
	}

	// The admin approves: Anna is told.
	requestID := count(t, "SELECT id FROM checkout_requests WHERE user_id = ?", anna.ID)
	if rec := serve(approveCheckoutRequest, admin, gin.Params{{Key: "id", Value: fmt.Sprint(requestID)}}, nil); rec.Code != http.StatusOK {
		t.Fatalf("approve: status %d: %s", rec.Code, rec.Body.String())
	}
	if box := readInbox(t, anna); len(box.Items) != 1 || box.Items[0].Kind != notifyLoanApproved {
		t.Fatalf("after approval Anna's inbox = %v", kinds(box))
	}

	// Anna reports the return twice: the managers are asked once.
	loanID := count(t, "SELECT id FROM archive_checkouts WHERE user_id = ? AND status = 'active' AND bundle_parent_item_id IS NULL", anna.ID)
	loan := gin.Params{{Key: "realm", Value: "archive"}, {Key: "id", Value: fmt.Sprint(loanID)}}
	serve(requestCheckoutReturn, anna, loan, nil)
	serve(requestCheckoutReturn, anna, loan, nil)
	if box := readInbox(t, ben); len(box.Items) != 2 || box.Items[0].Kind != notifyLoanReturnReported {
		t.Fatalf("after the report Ben's inbox = %v, want the report once on top", kinds(box))
	}

	// Ben says it is not back, Anna reports again, the admin confirms.
	serve(dismissCheckoutReturnRequest, ben, loan, nil)
	serve(requestCheckoutReturn, anna, loan, nil)
	item := gin.Params{{Key: "realm", Value: "archive"}, {Key: "item_id", Value: "1"}}
	if rec := serve(checkinItem, admin, item, map[string]interface{}{"checkout_id": loanID}); rec.Code != http.StatusOK {
		t.Fatalf("confirm: status %d: %s", rec.Code, rec.Body.String())
	}
	box := readInbox(t, anna)
	want := []string{notifyLoanReturnConfirmed, notifyLoanReturnDismissed, notifyLoanApproved}
	if fmt.Sprint(kinds(box)) != fmt.Sprint(want) || box.Unread != 3 {
		t.Fatalf("Anna's inbox = %v (%d unread), want %v", kinds(box), box.Unread, want)
	}

	// Reading one, then all; only her own.
	serve(markNotificationsRead, anna, nil, map[string]interface{}{"id": box.Items[0].ID})
	if after := readInbox(t, anna); after.Unread != 2 || after.Items[0].ReadAt == nil {
		t.Fatalf("after reading one: %d unread", after.Unread)
	}
	serve(markNotificationsRead, anna, nil, map[string]interface{}{})
	if after := readInbox(t, anna); after.Unread != 0 {
		t.Fatalf("after reading all: %d unread", after.Unread)
	}
	if readInbox(t, ben).Unread == 0 {
		t.Fatal("Anna marking hers as read emptied Ben's inbox")
	}

	// Deleting: one of her own, never someone else's, then everything read.
	bensNewest := readInbox(t, ben).Items[0].ID
	if rec := serve(deleteNotification, anna, gin.Params{{Key: "id", Value: fmt.Sprint(bensNewest)}}, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("deleting a foreign notification: status %d", rec.Code)
	}
	if rec := serve(deleteNotification, anna, gin.Params{{Key: "id", Value: fmt.Sprint(box.Items[0].ID)}}, nil); rec.Code != http.StatusOK {
		t.Fatalf("deleting an own notification: status %d", rec.Code)
	}
	if after := readInbox(t, anna); len(after.Items) != 2 {
		t.Fatalf("after deleting one: %d left, want 2", len(after.Items))
	}
	bensBefore := len(readInbox(t, ben).Items)
	serve(deleteReadNotifications, anna, nil, nil)
	if after := readInbox(t, anna); len(after.Items) != 0 {
		t.Fatalf("after deleting the read ones: %d left", len(after.Items))
	}
	if len(readInbox(t, ben).Items) != bensBefore {
		t.Fatal("Anna clearing her inbox removed Ben's unread notifications")
	}
}

// A user keeps the newest notifications only, and a rejected request tells its requester.
func TestNotificationsAreTrimmedAndRejectionIsTold(t *testing.T) {
	admin := useSQLite(t)
	anna := addBorrower(t, "anna@example.de")
	for i := 0; i < notificationsKept+5; i++ {
		notify([]int{anna.ID}, notifyLoanApproved, map[string]interface{}{"n": i}, "/checkouts")
	}
	if n := count(t, "SELECT COUNT(*) FROM notifications WHERE user_id = ?", anna.ID); n != notificationsKept {
		t.Fatalf("kept %d notifications, want %d", n, notificationsKept)
	}

	now := database.TimestampNow()
	mustExec(t, "INSERT INTO checkout_requests (realm, item_id, user_id, status, component_item_ids, created_at, updated_at) VALUES ('archive', 1, ?, 'pending', '[]', ?, ?)", anna.ID, now, now)
	requestID := count(t, "SELECT id FROM checkout_requests WHERE user_id = ?", anna.ID)
	if rec := serve(rejectCheckoutRequest, admin, gin.Params{{Key: "id", Value: fmt.Sprint(requestID)}}, nil); rec.Code != http.StatusOK {
		t.Fatalf("reject: status %d: %s", rec.Code, rec.Body.String())
	}
	if box := readInbox(t, anna); box.Items[0].Kind != notifyLoanRejected || box.Items[0].Data["item"] != "Bohrmaschine" {
		t.Fatalf("newest notification = %s %v, want the rejection", box.Items[0].Kind, box.Items[0].Data)
	}
}
