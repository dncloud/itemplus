package ai

import (
	"crypto/rand"
	"encoding/hex"
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

func SaveAITempImage(data []byte, mimeType string) string {
	cleanupAITempImages()
	id := randomTempImageID()
	aiTempImageStore.Lock()
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
