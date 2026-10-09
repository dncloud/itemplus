package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// dial opens a client/server websocket pair and returns both ends.
func dial(t *testing.T) (server, client *websocket.Conn) {
	t.Helper()
	upgrader := websocket.Upgrader{}
	serverCh := make(chan *websocket.Conn, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		serverCh <- conn
	}))
	t.Cleanup(srv.Close)

	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { client.Close() })

	select {
	case server = <-serverCh:
	case <-time.After(2 * time.Second):
		t.Fatal("server side of the websocket never arrived")
	}
	t.Cleanup(func() { server.Close() })
	return server, client
}

func newManager() *Manager {
	return &Manager{connections: make(map[int]*Connection)}
}

// Many handlers may push events to the same connection at once; gorilla
// panics on concurrent writers, so every message must arrive intact.
func TestConcurrentSendsToOneConnection(t *testing.T) {
	server, client := dial(t)
	m := newManager()
	m.Add(&Connection{Conn: server, UserID: 1, SessionID: 1, DeviceType: "browser", IsAdmin: true})

	const senders, perSender = 8, 25
	received := make(chan int, 1)
	go func() {
		n := 0
		for n < senders*perSender*2 {
			if _, _, err := client.ReadMessage(); err != nil {
				break
			}
			n++
		}
		received <- n
	}()

	var wg sync.WaitGroup
	for i := 0; i < senders; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < perSender; j++ {
				m.SendToUser(1, "test.user", map[string]interface{}{"n": j})
				m.Broadcast("test.all", map[string]interface{}{"n": j})
			}
		}()
	}
	wg.Wait()

	select {
	case n := <-received:
		if n != senders*perSender*2 {
			t.Fatalf("received %d messages, want %d", n, senders*perSender*2)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for messages")
	}
}

func TestSendFiltersByTarget(t *testing.T) {
	browserSrv, browser := dial(t)
	iosSrv, ios := dial(t)
	m := newManager()
	m.Add(&Connection{Conn: browserSrv, UserID: 1, SessionID: 1, DeviceType: "browser"})
	m.Add(&Connection{Conn: iosSrv, UserID: 1, SessionID: 2, DeviceType: "ios"})

	m.SendToUserIOS(1, "only.ios", nil)
	m.SendToUserExcept(1, 2, "only.browser", nil)

	for name, tc := range map[string]struct {
		conn *websocket.Conn
		want string
	}{"ios": {ios, "only.ios"}, "browser": {browser, "only.browser"}} {
		_ = tc.conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, msg, err := tc.conn.ReadMessage()
		if err != nil {
			t.Fatalf("%s: read: %v", name, err)
		}
		if !strings.Contains(string(msg), tc.want) {
			t.Fatalf("%s: got %s, want event %s", name, msg, tc.want)
		}
	}
}

// A reconnect reuses the session id. The old connection's cleanup must not
// unregister the connection that replaced it.
func TestRemoveKeepsNewerConnectionOfSameSession(t *testing.T) {
	oldSrv, _ := dial(t)
	newSrv, _ := dial(t)
	m := newManager()
	oldConn := &Connection{Conn: oldSrv, UserID: 1, SessionID: 7}
	newConn := &Connection{Conn: newSrv, UserID: 1, SessionID: 7}

	m.Add(oldConn)
	m.Add(newConn)

	if m.Remove(oldConn) {
		t.Fatal("Remove(old) reported the session as gone although a newer connection holds it")
	}
	if !m.HasSession(7) {
		t.Fatal("newer connection was unregistered by the old connection's cleanup")
	}
	if !m.Remove(newConn) {
		t.Fatal("Remove(new) should report the session as gone")
	}
	if m.HasSession(7) {
		t.Fatal("session still registered after its current connection was removed")
	}
}

func TestRemoveAfterKickReportsSessionGone(t *testing.T) {
	server, client := dial(t)
	m := newManager()
	conn := &Connection{Conn: server, UserID: 1, SessionID: 3}
	m.Add(conn)

	m.Kick(3)

	_ = client.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := client.ReadMessage()
	if err != nil || !strings.Contains(string(msg), "session.kicked") {
		t.Fatalf("expected session.kicked, got %q (err %v)", msg, err)
	}
	if !m.Remove(conn) {
		t.Fatal("Remove after Kick must report the session as gone so it is marked offline")
	}
}
