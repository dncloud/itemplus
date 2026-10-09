package operations

import (
	"testing"

	"github.com/itemplus/backend/internal/database"
)

// Two tabs of one browser, or two browsers behind one router, look the same
// to the server: same user, device type and IP address. Each connection must
// still get a session of its own, otherwise only the latest one receives
// live events and the tabs overwrite each other's current page.
func TestEveryConnectionGetsItsOwnDeviceSession(t *testing.T) {
	user := useSQLite(t)
	connected := map[int]bool{}
	inUse := func(id int) bool { return connected[id] }
	claim := func(deviceType, deviceName, ip string) int {
		t.Helper()
		id, err := claimDeviceSession(user.ID, deviceType, deviceName, ip, "test-agent", inUse)
		if err != nil {
			t.Fatalf("claimDeviceSession: %v", err)
		}
		connected[int(id)] = true
		return int(id)
	}

	firstTab := claim("browser", "Chrome (Mac)", "10.0.0.5")
	secondTab := claim("browser", "Chrome (Mac)", "10.0.0.5")
	safari := claim("browser", "Safari (Mac)", "10.0.0.5")
	phone := claim("ios", "Olis iPhone", "10.0.0.5")
	if firstTab == secondTab || firstTab == safari || secondTab == safari || phone == firstTab {
		t.Fatalf("connections share a session: tabs %d and %d, Safari %d, iPhone %d", firstTab, secondTab, safari, phone)
	}

	// A tab that reconnects takes a free session of its own kind again,
	// instead of piling up new ones.
	delete(connected, secondTab)
	if again := claim("browser", "Chrome (Mac)", "10.0.0.5"); again != secondTab {
		t.Fatalf("reconnecting tab got session %d, want its free session %d", again, secondTab)
	}

	// Safari's free session is kept for Safari while a Chrome one is free too.
	delete(connected, safari)
	delete(connected, firstTab)
	if again := claim("browser", "Safari (Mac)", "10.0.0.5"); again != safari {
		t.Fatalf("Safari reconnected onto session %d, want its own %d", again, safari)
	}

	// Another address never reuses these sessions.
	if elsewhere := claim("browser", "Chrome (Mac)", "10.0.0.9"); elsewhere == firstTab {
		t.Fatalf("a connection from another address reused session %d", elsewhere)
	}

	var online int
	if err := database.DB.Get(&online, "SELECT COUNT(*) FROM device_sessions WHERE is_online = 1"); err != nil {
		t.Fatal(err)
	}
	var total int
	_ = database.DB.Get(&total, "SELECT COUNT(*) FROM device_sessions")
	if total != 5 {
		t.Fatalf("%d session rows, want 5 (two Chrome tabs, Safari, iPhone, other address)", total)
	}
}
