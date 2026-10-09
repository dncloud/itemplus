package items

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/itemplus/backend/internal/http/middleware"
)

const gameCatalogResultLimit = 12

var gameCatalogHTTPClient = &http.Client{Timeout: 15 * time.Second}
var errGameCatalogNotFound = fmt.Errorf("game catalog resource not found")

type gameCatalogSchema struct {
	GlobalSearch  json.RawMessage     `json:"global_search"`
	SchemaVersion string              `json:"schema_version"`
	ItemPlus      gameCatalogContract `json:"itemplus"`
}
type gameCatalogContract struct {
	GlobalSearch     json.RawMessage      `json:"global_search,omitempty"`
	ContractVersion  string               `json:"contract_version"`
	DefaultLocale    string               `json:"default_locale"`
	SupportedLocales []string             `json:"supported_locales"`
	Profiles         []gameCatalogProfile `json:"profiles"`
}
type gameCatalogText struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}
type gameCatalogCategory struct {
	Name         string                     `json:"name"`
	Description  string                     `json:"description,omitempty"`
	Translations map[string]gameCatalogText `json:"translations,omitempty"`
}
type gameCatalogEndpoints struct {
	Search string `json:"search"`
	Detail string `json:"detail"`
	Assets string `json:"assets,omitempty"`
}
type gameCatalogProfileProperty struct {
	Key          string                     `json:"key"`
	Name         string                     `json:"name"`
	Translations map[string]gameCatalogText `json:"translations,omitempty"`
	PropertyType string                     `json:"property_type"`
	DisplayWidth string                     `json:"display_width"`
	Required     bool                       `json:"required"`
	ShowInList   bool                       `json:"show_in_list"`
	Setup        struct {
		EnabledByDefault bool `json:"enabled_by_default"`
	} `json:"setup"`
	Options map[string]interface{} `json:"options,omitempty"`
}
type gameCatalogProfile struct {
	PlatformSelection *gameCatalogPlatformSelection `json:"platform_selection,omitempty"`
	Key               string                        `json:"key"`
	Name              string                        `json:"name"`
	Translations      map[string]gameCatalogText    `json:"translations,omitempty"`
	Category          gameCatalogCategory           `json:"category"`
	Endpoints         gameCatalogEndpoints          `json:"endpoints"`
	Properties        []gameCatalogProfileProperty  `json:"properties"`
}
type gameCatalogPlatformSelection struct {
	Parameter string `json:"parameter"`
	Required  bool   `json:"required"`
	Choices   []struct {
		Key  string `json:"key"`
		Name string `json:"name"`
	} `json:"choices"`
}

func gameCatalogMetadataQuery(profile *gameCatalogProfile, locale, platform string) (url.Values, error) {
	query := url.Values{"locale": {locale}}
	selection := profile.PlatformSelection
	if selection == nil {
		return query, nil
	}
	if platform == "" && !selection.Required {
		return query, nil
	}
	for _, choice := range selection.Choices {
		if choice.Key == platform {
			parameter := selection.Parameter
			if parameter == "" {
				parameter = "platform"
			}
			query.Set(parameter, platform)
			return query, nil
		}
	}
	return nil, fmt.Errorf("Select a valid catalog platform")
}

type gameCatalogSearchResult struct {
	ProfileKey       string   `json:"profile_key,omitempty"`
	PlatformKey      string   `json:"platform_key,omitempty"`
	MobyID           int      `json:"moby_id,omitempty"`
	ID               int      `json:"id"`
	CanonicalTitle   string   `json:"canonical_title"`
	MatchedTitle     string   `json:"matched_title,omitempty"`
	FirstReleaseYear *int     `json:"first_release_year,omitempty"`
	Platforms        []string `json:"platforms,omitempty"`
}
type gameCatalogSearchPage struct {
	Items []gameCatalogSearchResult `json:"items"`
}
type gameCatalogAsset struct {
	MediaID      int             `json:"media_id"`
	Kind         string          `json:"kind"`
	Role         string          `json:"role"`
	Label        string          `json:"label,omitempty"`
	LabelDE      string          `json:"label_de,omitempty"`
	MediaType    string          `json:"media_type,omitempty"`
	AssetType    string          `json:"asset_type,omitempty"`
	AssetTypeDE  string          `json:"asset_type_de,omitempty"`
	Presentation json.RawMessage `json:"presentation,omitempty"`
	ImageText    string          `json:"image_text,omitempty"`
	ImageTextDE  string          `json:"image_text_de,omitempty"`
	ContentPath  string          `json:"content_path"`
	Platforms    []struct {
		Name string `json:"name"`
		Slug string `json:"slug,omitempty"`
	} `json:"platforms,omitempty"`
	Countries []struct {
		Code   string `json:"code"`
		Name   string `json:"name,omitempty"`
		NameDE string `json:"name_de,omitempty"`
	} `json:"countries,omitempty"`
	Attributes map[string][]string `json:"attributes,omitempty"`
	Comment    string              `json:"comment,omitempty"`
	CommentDE  string              `json:"comment_de,omitempty"`
	MIMEType   string              `json:"mime_type,omitempty"`
	Bytes      *int64              `json:"bytes,omitempty"`
	SHA256     string              `json:"sha256,omitempty"`
	Sequence   int                 `json:"sequence,omitempty"`
}
type gameCatalogAssets struct {
	Primary         *gameCatalogAsset  `json:"primary"`
	Gallery         []gameCatalogAsset `json:"gallery"`
	GalleryTotal    int                `json:"gallery_total"`
	GalleryEndpoint string             `json:"gallery_endpoint,omitempty"`
}
type gameCatalogDetail struct {
	MobyID         int    `json:"moby_id,omitempty"`
	PlatformKey    string `json:"platform_key,omitempty"`
	ID             int    `json:"id"`
	CanonicalTitle string `json:"canonical_title"`
	ItemPlus       struct {
		ProfileKey       string          `json:"profile_key"`
		SelectedPlatform string          `json:"selected_platform,omitempty"`
		Catalog          json.RawMessage `json:"catalog,omitempty"`
		Item             struct {
			Name                string `json:"name"`
			ExternalID          string `json:"external_id"`
			MobyID              string `json:"moby_id,omitempty"`
			Description         string `json:"description,omitempty"`
			DescriptionMarkdown string `json:"description_markdown,omitempty"`
		} `json:"item"`
		Assets         gameCatalogAssets      `json:"assets"`
		PropertyValues map[string]interface{} `json:"property_values"`
	} `json:"itemplus"`
}
type gameCatalogAssetPage struct {
	Items []gameCatalogAsset `json:"items"`
	Total int                `json:"total"`
}

func gameCatalogBaseURL() (*url.URL, error) {
	raw := strings.TrimSpace(config.C.GameCatalogURL)
	u, err := url.Parse(raw)
	if raw == "" || err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("game catalog is not configured")
	}
	return u, nil
}
func gameCatalogURL(relative string, query url.Values) (*url.URL, error) {
	if !strings.HasPrefix(relative, "/") || strings.HasPrefix(relative, "//") {
		return nil, fmt.Errorf("invalid catalog endpoint")
	}
	base, err := gameCatalogBaseURL()
	if err != nil {
		return nil, err
	}
	u, err := url.Parse(relative)
	if err != nil || u.Host != "" || u.Scheme != "" {
		return nil, fmt.Errorf("invalid catalog endpoint")
	}
	base.Path = strings.TrimRight(base.Path, "/") + path.Clean("/"+u.Path)
	base.RawQuery = query.Encode()
	return base, nil
}
func gameCatalogGet(relative string, query url.Values, target interface{}) error {
	u, err := gameCatalogURL(relative, query)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "itemplus-game-catalog/2.0")
	res, err := gameCatalogHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return errGameCatalogNotFound
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("catalog returned %s", res.Status)
	}
	return json.NewDecoder(res.Body).Decode(target)
}
func gameCatalogSchemaLoad() (gameCatalogSchema, error) {
	var schema gameCatalogSchema
	return schema, gameCatalogGet("/v1/schema", nil, &schema)
}
func findGameCatalogProfile(schema gameCatalogSchema, key string) (*gameCatalogProfile, error) {
	for i := range schema.ItemPlus.Profiles {
		if schema.ItemPlus.Profiles[i].Key == key {
			return &schema.ItemPlus.Profiles[i], nil
		}
	}
	return nil, errGameCatalogNotFound
}
func gameCatalogError(c *gin.Context, err error) {
	if err == errGameCatalogNotFound {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Game catalog resource not found"})
		return
	}
	c.JSON(http.StatusBadGateway, gin.H{"detail": "Game catalog is currently unavailable"})
}

func listGameCatalogProfiles(c *gin.Context) {
	schema, err := gameCatalogSchemaLoad()
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	schema.ItemPlus.GlobalSearch = schema.GlobalSearch
	c.JSON(http.StatusOK, schema.ItemPlus)
}
func listGlobalGameCatalogMatches(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len([]rune(q)) < 3 || len([]rune(q)) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Search needs between three and 100 characters"})
		return
	}
	var page gameCatalogSearchPage
	err := gameCatalogGet("/v1/itemplus/games", url.Values{"q": {q}, "limit": {strconv.Itoa(gameCatalogResultLimit)}}, &page)
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	if page.Items == nil {
		page.Items = []gameCatalogSearchResult{}
	}
	c.JSON(http.StatusOK, page)
}
func listGameCatalogMatches(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len([]rune(q)) < 3 || len([]rune(q)) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Search needs between three and 100 characters"})
		return
	}
	schema, err := gameCatalogSchemaLoad()
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	profile, err := findGameCatalogProfile(schema, c.Param("profileKey"))
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	var page gameCatalogSearchPage
	query, err := gameCatalogMetadataQuery(profile, c.DefaultQuery("locale", "en"), c.Query("platform"))
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": err.Error()})
		return
	}
	query.Set("q", q)
	query.Set("limit", strconv.Itoa(gameCatalogResultLimit))
	err = gameCatalogGet(profile.Endpoints.Search, query, &page)
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	if page.Items == nil {
		page.Items = []gameCatalogSearchResult{}
	}
	c.JSON(http.StatusOK, page)
}
func getGameCatalogGame(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("gameID"))
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid game id"})
		return
	}
	schema, err := gameCatalogSchemaLoad()
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	profile, err := findGameCatalogProfile(schema, c.Param("profileKey"))
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	var detail gameCatalogDetail
	query, err := gameCatalogMetadataQuery(profile, c.DefaultQuery("locale", "en"), c.Query("platform"))
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": err.Error()})
		return
	}
	endpoint := strings.ReplaceAll(profile.Endpoints.Detail, "{id}", strconv.Itoa(id))
	if err = gameCatalogGet(endpoint, query, &detail); err != nil {
		gameCatalogError(c, err)
		return
	}
	c.JSON(http.StatusOK, detail)
}
func listGameCatalogAssets(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("gameID"))
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid game id"})
		return
	}
	schema, err := gameCatalogSchemaLoad()
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	profile, err := findGameCatalogProfile(schema, c.Param("profileKey"))
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	endpoint := strings.ReplaceAll(profile.Endpoints.Assets, "{id}", strconv.Itoa(id))
	var page gameCatalogAssetPage
	if err = gameCatalogGet(endpoint, url.Values{"offset": {c.DefaultQuery("offset", "0")}, "limit": {c.DefaultQuery("limit", "24")}}, &page); err != nil {
		gameCatalogError(c, err)
		return
	}
	if page.Items == nil {
		page.Items = []gameCatalogAsset{}
	}
	c.JSON(http.StatusOK, page)
}

func getGameCatalogMediaContent(c *gin.Context) {
	mediaID, err := strconv.Atoi(c.Param("mediaID"))
	if err != nil || mediaID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid media id"})
		return
	}
	u, err := gameCatalogURL(fmt.Sprintf("/v1/itemplus/media/%d/content", mediaID), nil)
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	req.Header.Set("Accept", "image/*")
	req.Header.Set("User-Agent", "itemplus-game-catalog/2.0")
	res, err := gameCatalogHTTPClient.Do(req)
	if err != nil {
		gameCatalogError(c, err)
		return
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		gameCatalogError(c, errGameCatalogNotFound)
		return
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		gameCatalogError(c, fmt.Errorf("catalog returned %s", res.Status))
		return
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0]))
	if !strings.HasPrefix(contentType, "image/") {
		gameCatalogError(c, fmt.Errorf("catalog media is not an image"))
		return
	}
	c.Header("Cache-Control", "private, max-age=300")
	c.DataFromReader(http.StatusOK, res.ContentLength, contentType, io.LimitReader(res.Body, config.C.MaxUploadSize), nil)
}

type gameCatalogImportRequest struct {
	Assets []gameCatalogAsset `json:"assets"`
}

func importGameCatalogAssets(realm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")
		if !itemExists(realm+"_items", itemID) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Item not found"})
			return
		}
		var body gameCatalogImportRequest
		if c.ShouldBindJSON(&body) != nil || len(body.Assets) == 0 || len(body.Assets) > 25 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Select between one and 25 catalog images"})
			return
		}
		rows := make([]map[string]interface{}, 0, len(body.Assets))
		for index, asset := range body.Assets {
			row, err := storeGameCatalogAsset(c, realm, itemID, asset, index)
			if err != nil {
				gameCatalogError(c, err)
				return
			}
			rows = append(rows, row)
		}
		user := middleware.GetUser(c)
		middleware.Audit(user.ID, "attachment.catalog_import", fmt.Sprintf("realm=%s item=%s count=%d", realm, itemID, len(rows)))
		c.JSON(http.StatusCreated, gin.H{"attachments": rows})
	}
}
func storeGameCatalogAsset(c *gin.Context, realm, itemID string, asset gameCatalogAsset, order int) (map[string]interface{}, error) {
	if asset.MediaID < 1 || asset.ContentPath != fmt.Sprintf("/v1/itemplus/media/%d/content", asset.MediaID) {
		return nil, fmt.Errorf("invalid catalog asset")
	}
	u, err := gameCatalogURL(asset.ContentPath, nil)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := gameCatalogHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode == 404 {
		return nil, errGameCatalogNotFound
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("catalog returned %s", res.Status)
	}
	ct := res.Header.Get("Content-Type")
	ext := catalogImageExtension(ct)
	if ext == "" {
		return nil, fmt.Errorf("catalog asset is not a supported image")
	}
	filename := fmt.Sprintf("catalog-%d-%s%s", asset.MediaID, uuid.NewString()[:8], ext)
	dir := filepath.Join(config.C.UploadDir, realm, itemID)
	if err = os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	full := filepath.Join(dir, filename)
	file, err := os.Create(full)
	if err != nil {
		return nil, err
	}
	hash := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(file, hash), io.LimitReader(res.Body, config.C.MaxUploadSize+1))
	closeErr := file.Close()
	if copyErr != nil || closeErr != nil || written > config.C.MaxUploadSize {
		_ = os.Remove(full)
		return nil, fmt.Errorf("catalog image download failed")
	}
	if asset.SHA256 != "" && !strings.EqualFold(asset.SHA256, hex.EncodeToString(hash.Sum(nil))) {
		_ = os.Remove(full)
		return nil, fmt.Errorf("catalog image checksum mismatch")
	}
	now := database.TimestampNow()
	table := realm + "_attachments"
	result, err := database.DB.Exec(fmt.Sprintf("INSERT INTO %s (item_id, filename, file_path, storage_backend, attachment_type, description, gallery, size, `order`, created_at, updated_at) VALUES (?, ?, ?, 'local', 'image', ?, 1, ?, ?, ?, ?)", table), itemID, filename, path.Join(realm, itemID, filename), asset.Label, written, order, now, now)
	if err != nil {
		_ = os.Remove(full)
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return loadAttachmentRow(realm, table, id)
}
func catalogImageExtension(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0])) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/avif":
		return ".avif"
	}
	return ""
}
