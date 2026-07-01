package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Connection struct {
	Conn         *websocket.Conn
	UserID       int
	SessionID    int
	DeviceType   string
	DeviceName   string
	CurrentPath  string
	CurrentLabel string
	CurrentRealm string
	IsAdmin      bool
}

type Manager struct {
	mu          sync.RWMutex
	connections map[int]*Connection // session_id -> connection
}

var M = &Manager{connections: make(map[int]*Connection)}

func (m *Manager) Add(conn *Connection) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connections[conn.SessionID] = conn
}

func (m *Manager) Remove(sessionID int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.connections[sessionID]; ok {
		c.Conn.Close()
		delete(m.connections, sessionID)
	}
}

func (m *Manager) SendToSession(sessionID int, event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if c, ok := m.connections[sessionID]; ok {
		msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
		c.Conn.WriteMessage(websocket.TextMessage, msg)
	}
}

func (m *Manager) SendToUser(userID int, event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		if c.UserID == userID {
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func (m *Manager) SendToUserExcept(userID int, excludeSessionID int, event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		if c.UserID == userID && c.SessionID != excludeSessionID {
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func (m *Manager) SendToUserBrowsers(userID int, event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		if c.UserID == userID && c.DeviceType == "browser" {
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func (m *Manager) SendToUserIOS(userID int, event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		if c.UserID == userID && c.DeviceType == "ios" {
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func (m *Manager) SendToAdmins(event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		if c.IsAdmin {
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func (m *Manager) Broadcast(event string, data map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	msg, _ := json.Marshal(map[string]interface{}{"event": event, "data": data})
	for _, c := range m.connections {
		c.Conn.WriteMessage(websocket.TextMessage, msg)
	}
}

func (m *Manager) HasIOSDevices(userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, c := range m.connections {
		if c.UserID == userID && c.DeviceType == "ios" {
			return true
		}
	}
	return false
}

func (m *Manager) HasSession(sessionID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.connections[sessionID]
	return ok
}

func (m *Manager) SessionBelongsToUser(sessionID, userID int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if c, ok := m.connections[sessionID]; ok {
		return c.UserID == userID
	}
	return false
}

func (m *Manager) UpdatePresence(sessionID int, path, label, realm string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.connections[sessionID]; ok {
		c.CurrentPath = path
		c.CurrentLabel = label
		c.CurrentRealm = realm
	}
}

func (m *Manager) GetUserDevices(userID int) []map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var devices []map[string]interface{}
	for _, c := range m.connections {
		if c.UserID == userID {
			devices = append(devices, map[string]interface{}{
				"session_id":    c.SessionID,
				"device_type":   c.DeviceType,
				"device_name":   c.DeviceName,
				"current_path":  c.CurrentPath,
				"current_label": c.CurrentLabel,
				"current_realm": c.CurrentRealm,
			})
		}
	}
	return devices
}

func (m *Manager) Kick(sessionID int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.connections[sessionID]; ok {
		msg, _ := json.Marshal(map[string]interface{}{"event": "session.kicked", "data": map[string]interface{}{}})
		c.Conn.WriteMessage(websocket.TextMessage, msg)
		c.Conn.Close()
		delete(m.connections, sessionID)
	}
}

func (m *Manager) CheckPermission(userID int, perm string) bool {
	// This needs DB access — done in the handler
	log.Printf("Permission check for user %d: %s", userID, perm)
	return false
}
