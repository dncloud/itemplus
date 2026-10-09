package items

import (
	"encoding/json"
	"net/url"
	"strings"
	"testing"
)

func TestFindGameCatalogProfile(t *testing.T) {
	schema := gameCatalogSchema{ItemPlus: gameCatalogContract{Profiles: []gameCatalogProfile{{Key: "pc-games"}}}}
	profile, err := findGameCatalogProfile(schema, "pc-games")
	if err != nil || profile.Key != "pc-games" {
		t.Fatalf("expected pc-games profile, got %#v, %v", profile, err)
	}
	if _, err := findGameCatalogProfile(schema, "missing"); err != errGameCatalogNotFound {
		t.Fatalf("expected missing profile error, got %v", err)
	}
}

func TestGlobalGameCatalogContract(t *testing.T) {
	var schema gameCatalogSchema
	if err := json.Unmarshal([]byte(`{"global_search":{"shortcuts":{"dos":{"profile_key":"pc-games","platform_key":"dos"}}},"itemplus":{"profiles":[]}}`), &schema); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(schema.GlobalSearch), "dos") {
		t.Fatal("global search shortcuts were lost")
	}
	var page gameCatalogSearchPage
	if err := json.Unmarshal([]byte(`{"items":[{"id":36501,"canonical_title":"Duke Nukem 3D","profile_key":"pc-games","platform_key":"dos"}]}`), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ProfileKey != "pc-games" || page.Items[0].PlatformKey != "dos" {
		t.Fatalf("global search edition mapping was lost: %#v", page.Items)
	}
}

func TestGameCatalogURLRejectsExternalPaths(t *testing.T) {
	for _, raw := range []string{"https://example.test/v1/schema", "//example.test/catalog", "relative"} {
		if _, err := gameCatalogURL(raw, url.Values{}); err == nil {
			t.Fatalf("expected %q to be rejected", raw)
		}
	}
}

func TestCatalogImageExtension(t *testing.T) {
	if got := catalogImageExtension("image/jpeg; charset=binary"); got != ".jpg" {
		t.Fatalf("expected jpg, got %q", got)
	}
	if got := catalogImageExtension("application/pdf"); got != "" {
		t.Fatalf("expected unsupported type, got %q", got)
	}
}

func TestGameCatalogDetailReadsItemPlusPayload(t *testing.T) {
	var detail gameCatalogDetail
	err := json.Unmarshal([]byte(`{
		"id":365,
		"canonical_title":"Duke Nukem 3D",
		"itemplus":{
			"profile_key":"pc-games",
			"item":{"name":"Duke Nukem 3D","external_id":"365"},
			"assets":{"gallery":[]},
			"property_values":{"description":"A classic."}
		}
	}`), &detail)
	if err != nil {
		t.Fatalf("unmarshal detail: %v", err)
	}
	if detail.ItemPlus.ProfileKey != "pc-games" || detail.ItemPlus.Item.Name != "Duke Nukem 3D" {
		t.Fatalf("expected itemplus game payload, got %#v", detail.ItemPlus)
	}
}

func TestGameCatalogPlatformSelection(t *testing.T) {
	var profile gameCatalogProfile
	if err := json.Unmarshal([]byte(`{"key":"pc-games","platform_selection":{"parameter":"platform","required":true,"choices":[{"key":"dos","name":"DOS"},{"key":"windows","name":"Windows"}]}}`), &profile); err != nil {
		t.Fatal(err)
	}
	for _, platform := range []string{"", "unknown"} {
		if _, err := gameCatalogMetadataQuery(&profile, "de", platform); err == nil {
			t.Fatalf("expected invalid platform %q to fail", platform)
		}
	}
	query, err := gameCatalogMetadataQuery(&profile, "de", "dos")
	if err != nil || query.Get("platform") != "dos" || query.Get("locale") != "de" {
		t.Fatalf("unexpected metadata query: %v, %v", query, err)
	}
	query, err = gameCatalogMetadataQuery(&gameCatalogProfile{Key: "amiga"}, "de", "")
	if err != nil || query.Get("platform") != "" {
		t.Fatalf("profile without platform selection should remain supported: %v, %v", query, err)
	}
}

func TestGameCatalogEditionContract(t *testing.T) {
	var detail gameCatalogDetail
	err := json.Unmarshal([]byte(`{"id":33801,"moby_id":338,"platform_key":"dos","itemplus":{"profile_key":"pc-games","selected_platform":"dos","item":{"name":"Command & Conquer","external_id":"33801","moby_id":"338","description_markdown":"*Command & Conquer*"},"catalog":{"titles":[{"title":"Der Tiberiumkonflikt","note_de":"Deutscher Titel","platform":"DOS"}]},"assets":{"primary":{"media_id":27871,"kind":"image","role":"cover","label":"Cover Box Front","label_de":"Cover Box vorne","image_text_de":"Deutsche Ausgabe","media_type":"covers","asset_type":"Front Cover","asset_type_de":"Vorderes Cover","presentation":{"position":"Front"}},"gallery":[],"gallery_total":0},"property_values":{"platforms":["DOS"],"publisher":["Virgin Interactive"]}}}`), &detail)
	if err != nil {
		t.Fatal(err)
	}
	if detail.ID != 33801 || detail.MobyID != 338 || detail.ItemPlus.Item.ExternalID != "33801" || detail.PlatformKey != "dos" {
		t.Fatalf("edition identity lost: %#v", detail)
	}
	primary := detail.ItemPlus.Assets.Primary
	if primary == nil || primary.Role != "cover" || primary.LabelDE != "Cover Box vorne" || primary.ImageTextDE != "Deutsche Ausgabe" || len(primary.Presentation) == 0 {
		t.Fatalf("media metadata lost: %#v", primary)
	}
	if detail.ItemPlus.Item.DescriptionMarkdown != "*Command & Conquer*" || !strings.Contains(string(detail.ItemPlus.Catalog), "note_de") {
		t.Fatal("localized detail metadata lost")
	}
}
