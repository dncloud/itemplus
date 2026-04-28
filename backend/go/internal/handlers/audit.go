package handlers

import (
	"log"
)

// audit logs a security-relevant action with an [AUDIT] prefix for easy filtering.
func audit(userID int, action string, details string) {
	if details != "" {
		log.Printf("[AUDIT] user=%d action=%s %s", userID, action, details)
	} else {
		log.Printf("[AUDIT] user=%d action=%s", userID, action)
	}
}
