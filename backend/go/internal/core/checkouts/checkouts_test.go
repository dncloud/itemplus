package checkouts

import (
	"testing"
	"time"
)

func TestReminderCooldownHelpers(t *testing.T) {
	lastReminder := time.Date(2026, time.July, 8, 10, 0, 0, 0, time.Local)
	nextReminder := NextReminderTime(lastReminder)

	if got, want := nextReminder.Format("2006-01-02"), "2026-07-15"; got != want {
		t.Fatalf("next reminder date = %s, want %s", got, want)
	}

	if !IsReminderCooldownActive(time.Date(2026, time.July, 14, 18, 0, 0, 0, time.Local), lastReminder) {
		t.Fatalf("expected cooldown to still be active")
	}

	if IsReminderCooldownActive(time.Date(2026, time.July, 15, 10, 0, 0, 0, time.Local), lastReminder) {
		t.Fatalf("expected cooldown to have ended")
	}

	if got := ReminderCooldownRemainingDays(time.Date(2026, time.July, 14, 18, 0, 0, 0, time.Local), lastReminder); got != 1 {
		t.Fatalf("remaining cooldown days = %d, want 1", got)
	}
}
