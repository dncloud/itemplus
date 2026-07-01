package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	timestamps []time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateLimitEntry
	max     int
	window  time.Duration
}

var (
	limiters   = map[string]*rateLimiter{}
	limitersMu sync.Mutex
)

// getLimiter returns a shared rate limiter for the given key (max + window combination).
func getLimiter(max int, window time.Duration) *rateLimiter {
	key := fmt.Sprintf("%d_%d", max, window.Milliseconds())
	limitersMu.Lock()
	defer limitersMu.Unlock()

	if rl, ok := limiters[key]; ok {
		return rl
	}

	rl := &rateLimiter{
		entries: make(map[string]*rateLimitEntry),
		max:     max,
		window:  window,
	}
	limiters[key] = rl

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// allow checks if the given IP is within the rate limit.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	entry, ok := rl.entries[ip]
	if !ok {
		entry = &rateLimitEntry{}
		rl.entries[ip] = entry
	}

	// Remove expired timestamps
	valid := entry.timestamps[:0]
	for _, ts := range entry.timestamps {
		if ts.After(cutoff) {
			valid = append(valid, ts)
		}
	}
	entry.timestamps = valid

	if len(entry.timestamps) >= rl.max {
		return false
	}

	entry.timestamps = append(entry.timestamps, now)
	return true
}

// cleanup periodically removes stale entries.
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-rl.window)
		for ip, entry := range rl.entries {
			valid := entry.timestamps[:0]
			for _, ts := range entry.timestamps {
				if ts.After(cutoff) {
					valid = append(valid, ts)
				}
			}
			if len(valid) == 0 {
				delete(rl.entries, ip)
			} else {
				entry.timestamps = valid
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimit returns a Gin middleware that limits requests per IP
// using a sliding window approach.
func RateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	rl := getLimiter(maxRequests, window)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"detail": "Too many requests. Please try again later.",
			})
			return
		}
		c.Next()
	}
}
