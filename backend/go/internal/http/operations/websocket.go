package operations

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/itemplus/backend/internal/config"
	authcore "github.com/itemplus/backend/internal/core/auth"
	"github.com/itemplus/backend/internal/database"
	authhandlers "github.com/itemplus/backend/internal/http/auth"
	ws "github.com/itemplus/backend/internal/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		for _, allowed := range config.C.CORSOrigins {
			if allowed == "*" || allowed == origin {
				return true
			}
		}
		log.Printf("WebSocket origin rejected: %s", origin)
		return false
	},
}

const (
	wsWriteWait  = 10 * time.Second
	wsPongWait   = 75 * time.Second
	wsPingPeriod = 30 * time.Second
)

func RegisterWebSocketRoute(r *gin.Engine) {
	r.GET("/ws", handleWebSocket)
}

func loadActiveUserFlags(userID int) (isActive, isAdmin bool, err error) {
	err = database.DB.QueryRow("SELECT is_active, is_admin FROM users WHERE id = ? AND "+authhandlers.VisibleUsersWhereClause(""), userID).Scan(&isActive, &isAdmin)
	return
}

func handleWebSocket(c *gin.Context) {
	token := c.Query("token")
	ticket := c.Query("ticket")
	deviceType := c.DefaultQuery("device_type", "browser")
	deviceName := c.Query("device_name")

	var userID int
	var isActive, isAdmin bool

	if ticket != "" {
		// Authenticate via single-use WebSocket ticket (WebApp with HttpOnly cookies)
		uid, ok := authhandlers.ValidateWSTicket(ticket)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid or expired ticket"})
			return
		}
		userID = uid
		var err error
		isActive, isAdmin, err = loadActiveUserFlags(userID)
		if err != nil || !isActive {
			c.JSON(http.StatusForbidden, gin.H{"detail": "User not active"})
			return
		}
	} else if token != "" {
		// Authenticate via JWT token (iOS app)
		claims, err := authcore.DecodeToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
			return
		}
		userID = claims.UserID
		isActive, isAdmin, err = loadActiveUserFlags(userID)
		if err != nil || !isActive {
			c.JSON(http.StatusForbidden, gin.H{"detail": "User not active"})
			return
		}
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Token or ticket required"})
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	_ = conn.SetReadDeadline(time.Now().Add(wsPongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	clientIP := config.ResolveClientIP(c.Request.RemoteAddr, c.Request.Header)

	// Create or reuse device session
	var sessionID int64
	err = database.DB.QueryRow(
		"SELECT id FROM device_sessions WHERE user_id = ? AND device_type = ? AND ip_address = ? ORDER BY last_seen DESC LIMIT 1",
		userID, deviceType, clientIP,
	).Scan(&sessionID)

	now := database.TimestampNow()
	if err != nil {
		// New session
		result, execErr := database.DB.Exec(
			"INSERT INTO device_sessions (user_id, device_type, device_name, ip_address, is_online, last_seen, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)",
			userID, deviceType, deviceName, clientIP, now, c.GetHeader("User-Agent"), now, now,
		)
		if execErr != nil {
			log.Printf("WS session insert error: %v", execErr)
			conn.Close()
			return
		}
		sessionID, _ = result.LastInsertId()
	} else {
		database.DB.Exec("UPDATE device_sessions SET is_online = 1, last_seen = ?, device_name = ? WHERE id = ?", now, deviceName, sessionID)
	}

	// Clean up old offline sessions for this user (keep max 10)
	cleanupOldSessions(userID)

	wsConn := &ws.Connection{
		Conn:       conn,
		UserID:     userID,
		SessionID:  int(sessionID),
		DeviceType: deviceType,
		DeviceName: deviceName,
		IsAdmin:    isAdmin,
	}
	ws.M.Add(wsConn)
	ws.M.SendToSession(int(sessionID), "session.ready", map[string]interface{}{
		"session_id": sessionID,
	})

	// Notify other devices
	ws.M.SendToUserExcept(userID, int(sessionID), "device.connected", map[string]interface{}{
		"session_id":  sessionID,
		"device_type": deviceType,
		"device_name": deviceName,
	})

	done := make(chan struct{})

	defer func() {
		close(done)
		ws.M.Remove(int(sessionID))
		database.DB.Exec("UPDATE device_sessions SET is_online = 0, last_seen = ? WHERE id = ?", database.TimestampNow(), sessionID)
		ws.M.SendToUser(userID, "device.disconnected", map[string]interface{}{
			"session_id":  sessionID,
			"device_type": deviceType,
			"device_name": deviceName,
		})
	}()

	go func() {
		ticker := time.NewTicker(wsPingPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(wsWriteWait)); err != nil {
					_ = conn.Close()
					return
				}
			}
		}
	}()

	// Message loop
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var data map[string]interface{}
		if err := json.Unmarshal(message, &data); err != nil {
			continue
		}

		handleWSMessage(data, userID, int(sessionID), deviceType)
	}
}
