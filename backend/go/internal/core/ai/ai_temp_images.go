package ai

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"
)

type AITempImage struct {
	ID        string
	Data      []byte
	MimeType  string
	CreatedAt time.Time
}

var aiTempImageStore = struct {
	sync.Mutex
	items map[string]AITempImage
}{
	items: map[string]AITempImage{},
}

// Temporary images live in memory only, so both a single image and the
// store as a whole are bounded.
const (
	MaxAITempImageBytes = 20 << 20
	maxAITempImages     = 40
)

// AITempImageType returns the image type the data really is, judged by its
// content, and whether it is one of the raster formats accepted here. What a
// client claims is ignored: an SVG, for example, can carry scripts and must
// not be stored and served back as an "image".
func AITempImageType(data []byte) (string, bool) {
	mimeType := http.DetectContentType(data)
	switch mimeType {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return mimeType, true
	default:
		return mimeType, false
	}
}

func SaveAITempImage(data []byte, mimeType string) string {
	cleanupAITempImages()
	id := randomTempImageID()
	aiTempImageStore.Lock()
	// Make room by dropping the oldest images once the store is full.
	for len(aiTempImageStore.items) >= maxAITempImages {
		oldestID, oldest := "", time.Time{}
		for existingID, item := range aiTempImageStore.items {
			if oldestID == "" || item.CreatedAt.Before(oldest) {
				oldestID, oldest = existingID, item.CreatedAt
			}
		}
		delete(aiTempImageStore.items, oldestID)
	}
	aiTempImageStore.items[id] = AITempImage{
		ID:        id,
		Data:      append([]byte(nil), data...),
		MimeType:  mimeType,
		CreatedAt: time.Now(),
	}
	aiTempImageStore.Unlock()
	return id
}

func GetAITempImage(id string) (*AITempImage, bool) {
	cleanupAITempImages()
	aiTempImageStore.Lock()
	defer aiTempImageStore.Unlock()
	item, ok := aiTempImageStore.items[id]
	if !ok {
		return nil, false
	}
	copyItem := item
	return &copyItem, true
}

func DeleteAITempImage(id string) {
	aiTempImageStore.Lock()
	delete(aiTempImageStore.items, id)
	aiTempImageStore.Unlock()
}

func loadAIImageInput(tempImageID string) (*AIImageInput, bool) {
	if strings.TrimSpace(tempImageID) == "" {
		return nil, false
	}
	image, ok := GetAITempImage(strings.TrimSpace(tempImageID))
	if !ok {
		return nil, false
	}
	return &AIImageInput{Data: image.Data, MimeType: image.MimeType}, true
}

func cleanupAITempImages() {
	cutoff := time.Now().Add(-30 * time.Minute)
	aiTempImageStore.Lock()
	for id, item := range aiTempImageStore.items {
		if item.CreatedAt.Before(cutoff) {
			delete(aiTempImageStore.items, id)
		}
	}
	aiTempImageStore.Unlock()
}

func randomTempImageID() string {
	var buf [12]byte
	_, _ = rand.Read(buf[:])
	return hex.EncodeToString(buf[:])
}
