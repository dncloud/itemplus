package seed

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/itemplus/backend/internal/config"
	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

type Options struct {
	Reset      bool
	BaseURL    string
	Stdout     io.Writer
	AdminName  string
	AdminEmail string
	Lang       string
	Preset     string
}

type userSeed struct {
	Name        string
	Email       string
	AppleSub    string
	IsAdmin     bool
	IsActive    bool
	Permissions []string
}

type propertySeed struct {
	Name        string
	Type        string
	Unit        string
	Options     map[string]interface{}
	Required    bool
	ShowInList  bool
	DisplayWide string
}

type categorySeed struct {
	Name        string
	Description string
	Color       string
	Properties  []propertySeed
}

type locationSeed struct {
	Name        string
	Description string
	Color       string
	Parent      string
	Capacity    *int
}

type vendorSeed struct {
	Name    string
	Website string
	Email   string
}

type attachmentSeed struct {
	Filename string
	Type     string
	URL      string
	Note     string
}

type itemSeed struct {
	Name          string
	Description   string
	Category      string
	Location      string
	Quantity      int
	IsConsumable  bool
	MinimumQty    *int
	Manufacturer  string
	Supplier      string
	Vendor        string
	PurchasePrice float64
	Currency      string
	PurchaseDate  string
	Properties    map[string]interface{}
	Attachments   []attachmentSeed
}

type checkoutSeed struct {
	ItemName string
	UserMail string
	Status   string
	DueDate  string
	Returned string
	Notes    string
}

type requestSeed struct {
	ItemName     string
	UserMail     string
	Status       string
	DurationDays *int
	ApprovedBy   string
	Notes        string
}

type realmDataset struct {
	Categories    []categorySeed
	Locations     []locationSeed
	Manufacturers []vendorSeed
	Suppliers     []vendorSeed
	Vendors       []vendorSeed
	Items         []itemSeed
	Checkouts     []checkoutSeed
	Requests      []requestSeed
}

func Run(opts Options) error {
	out := opts.Stdout
	if out == nil {
		out = io.Discard
	}

	baseURL := strings.TrimRight(strings.TrimSpace(opts.BaseURL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(config.C.MagicLinkBaseURL, "/")
	}
	if baseURL == "" {
		baseURL = "http://127.0.0.1:3000"
	}

	if !opts.Reset {
		hasData, err := databaseHasData()
		if err != nil {
			return err
		}
		if hasData {
			return fmt.Errorf("database already contains item+ data; rerun with --reset to replace it")
		}
	}

	tx, err := database.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if opts.Reset {
		if err := wipeAll(tx); err != nil {
			return err
		}
	}

	lang := normalizeLang(opts.Lang)
	preset := "curated"

	users := curatedUsers(opts.AdminName, opts.AdminEmail)
	userIDs := map[string]int{}
	for idx, user := range users {
		perms, _ := json.Marshal(user.Permissions)
		now := nowRFC3339()
		result, err := tx.Exec(
			`INSERT INTO users (apple_sub, email, display_name, is_admin, is_active, permissions, last_login, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			user.AppleSub, user.Email, user.Name, user.IsAdmin, user.IsActive, string(perms), now, now, now,
		)
		if err != nil {
			return fmt.Errorf("insert user %s: %w", user.Email, err)
		}
		id, _ := result.LastInsertId()
		userIDs[user.Email] = int(id)
		if idx == 0 {
			fmt.Fprintf(out, localeText(lang, "createdAdmin"), user.Name, user.Email)
		}
	}

	for realm, data := range datasetForPreset(preset, users[0].Email, lang) {
		if err := seedRealm(tx, realm, data, userIDs); err != nil {
			return err
		}
	}

	loginLinks, err := createMagicLinks(tx, baseURL, []string{users[0].Email})
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	fmt.Fprintln(out)
	fmt.Fprintln(out, localeText(lang, presetSeededKey(preset)))
	fmt.Fprintln(out)
	fmt.Fprintln(out, localeText(lang, "loginLinks"))
	for _, link := range loginLinks {
		fmt.Fprintf(out, "- %s: %s\n", link.Label, link.URL)
	}
	fmt.Fprintln(out)
	fmt.Fprintln(out, localeText(lang, "resetTip"))
	return nil
}

func RunDemo(opts Options) error {
	opts.Preset = "curated"
	return Run(opts)
}

type magicLink struct {
	Label string
	URL   string
}

func createMagicLinks(tx *sqlx.Tx, baseURL string, emails []string) ([]magicLink, error) {
	var links []magicLink
	expiry := time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)
	for _, email := range emails {
		token, err := randomToken(36)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(
			`INSERT INTO magic_link_tokens (email, token, expires_at, used) VALUES (?, ?, ?, 0)`,
			email, token, expiry,
		); err != nil {
			return nil, fmt.Errorf("insert magic link token for %s: %w", email, err)
		}
		links = append(links, magicLink{
			Label: email,
			URL:   fmt.Sprintf("%s/auth/magic/%s", baseURL, token),
		})
	}
	return links, nil
}

func seedRealm(tx *sqlx.Tx, realm string, data realmDataset, userIDs map[string]int) error {
	categoryIDs := map[string]int{}
	propertyIDs := map[string]int{}
	locationIDs := map[string]int{}
	manufacturerIDs := map[string]int{}
	supplierIDs := map[string]int{}
	vendorIDs := map[string]int{}
	itemIDs := map[string]int{}

	for idx, category := range data.Categories {
		now := nowRFC3339()
		result, err := tx.Exec(
			fmt.Sprintf(`INSERT INTO %s_categories (name, description, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, realm),
			category.Name, category.Description, category.Color, idx, now, now,
		)
		if err != nil {
			return fmt.Errorf("%s category %s: %w", realm, category.Name, err)
		}
		id, _ := result.LastInsertId()
		categoryIDs[category.Name] = int(id)

		for propPos, property := range category.Properties {
			optionsJSON, _ := json.Marshal(property.Options)
			displayWidth := property.DisplayWide
			if displayWidth == "" {
				displayWidth = "third"
			}
			propResult, err := tx.Exec(
				fmt.Sprintf(`INSERT INTO %s_properties (category_id, name, property_type, unit, options, required, show_in_list, display_width, position, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, realm),
				id, property.Name, property.Type, nullIfEmpty(property.Unit), string(optionsJSON), property.Required, property.ShowInList, displayWidth, propPos, now, now,
			)
			if err != nil {
				return fmt.Errorf("%s property %s: %w", realm, property.Name, err)
			}
			propID, _ := propResult.LastInsertId()
			propertyIDs[category.Name+"::"+property.Name] = int(propID)
		}
	}

	for idx, location := range data.Locations {
		now := nowRFC3339()
		var parent interface{}
		if location.Parent != "" {
			parent = locationIDs[location.Parent]
		}
		result, err := tx.Exec(
			fmt.Sprintf(`INSERT INTO %s_locations (name, description, color, parent_id, capacity, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, realm),
			location.Name, location.Description, location.Color, parent, location.Capacity, idx, now, now,
		)
		if err != nil {
			return fmt.Errorf("%s location %s: %w", realm, location.Name, err)
		}
		id, _ := result.LastInsertId()
		locationIDs[location.Name] = int(id)
	}

	for _, vendor := range data.Manufacturers {
		id, err := insertVendor(tx, realm+"_manufacturers", vendor)
		if err != nil {
			return err
		}
		manufacturerIDs[vendor.Name] = id
	}
	for _, vendor := range data.Suppliers {
		id, err := insertVendor(tx, realm+"_suppliers", vendor)
		if err != nil {
			return err
		}
		supplierIDs[vendor.Name] = id
	}
	for _, vendor := range data.Vendors {
		id, err := insertVendor(tx, realm+"_vendors", vendor)
		if err != nil {
			return err
		}
		vendorIDs[vendor.Name] = id
	}

	for _, item := range data.Items {
		now := nowRFC3339()
		result, err := tx.Exec(
			fmt.Sprintf(`INSERT INTO %s_items (name, description, category_id, location_id, quantity, is_consumable, minimum_quantity, manufacturer_id, supplier_id, vendor_id, purchase_date, purchase_price, purchase_currency, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, realm),
			item.Name,
			item.Description,
			categoryIDs[item.Category],
			locationIDs[item.Location],
			item.Quantity,
			item.IsConsumable,
			item.MinimumQty,
			lookupOptional(manufacturerIDs, item.Manufacturer),
			lookupOptional(supplierIDs, item.Supplier),
			lookupOptional(vendorIDs, item.Vendor),
			item.PurchaseDate,
			item.PurchasePrice,
			defaultCurrency(item.Currency),
			now,
			now,
		)
		if err != nil {
			return fmt.Errorf("%s item %s: %w", realm, item.Name, err)
		}
		itemID64, _ := result.LastInsertId()
		itemID := int(itemID64)
		itemIDs[item.Name] = itemID

		for propName, rawValue := range item.Properties {
			propID := propertyIDs[item.Category+"::"+propName]
			if propID == 0 {
				return fmt.Errorf("%s item %s references unknown property %s", realm, item.Name, propName)
			}
			if _, err := tx.Exec(
				fmt.Sprintf(`INSERT INTO %s_item_properties (item_id, property_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, realm),
				itemID, propID, encodePropertyValue(rawValue), now, now,
			); err != nil {
				return fmt.Errorf("%s item property %s on %s: %w", realm, propName, item.Name, err)
			}
		}

		for idx, attachment := range item.Attachments {
			if _, err := tx.Exec(
				fmt.Sprintf(`INSERT INTO %s_attachments (item_id, filename, file_path, attachment_type, url, description, gallery, size, "order", created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`, realm),
				itemID, attachment.Filename, nil, attachment.Type, attachment.URL, attachment.Note, idx, now, now,
			); err != nil {
				return fmt.Errorf("%s attachment on %s: %w", realm, item.Name, err)
			}
		}
	}

	for _, request := range data.Requests {
		now := nowRFC3339()
		if _, err := tx.Exec(
			`INSERT INTO checkout_requests (realm, item_id, user_id, status, requested_duration_days, approved_by, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			realm,
			itemIDs[request.ItemName],
			userIDs[request.UserMail],
			request.Status,
			request.DurationDays,
			lookupOptional(userIDs, request.ApprovedBy),
			request.Notes,
			now,
			now,
		); err != nil {
			return fmt.Errorf("%s checkout request for %s: %w", realm, request.ItemName, err)
		}
	}

	for _, checkout := range data.Checkouts {
		now := nowRFC3339()
		if _, err := tx.Exec(
			fmt.Sprintf(`INSERT INTO %s_checkouts (item_id, user_id, status, due_date, returned_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, realm),
			itemIDs[checkout.ItemName],
			userIDs[checkout.UserMail],
			checkout.Status,
			emptyToNil(checkout.DueDate),
			emptyToNil(checkout.Returned),
			checkout.Notes,
			now,
			now,
		); err != nil {
			return fmt.Errorf("%s checkout for %s: %w", realm, checkout.ItemName, err)
		}
	}

	return nil
}

func insertVendor(tx *sqlx.Tx, table string, vendor vendorSeed) (int, error) {
	now := nowRFC3339()
	result, err := tx.Exec(
		fmt.Sprintf(`INSERT INTO %s (name, website, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, table),
		vendor.Name, nullIfEmpty(vendor.Website), nullIfEmpty(vendor.Email), now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("%s vendor %s: %w", table, vendor.Name, err)
	}
	id, _ := result.LastInsertId()
	return int(id), nil
}

func databaseHasData() (bool, error) {
	var count int
	for _, query := range []string{
		`SELECT COUNT(*) FROM users`,
		`SELECT COUNT(*) FROM archive_items`,
		`SELECT COUNT(*) FROM collection_items`,
	} {
		if err := database.DB.Get(&count, query); err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	return false, nil
}

func wipeAll(tx *sqlx.Tx) error {
	for _, table := range []string{
		"magic_link_tokens",
		"qr_login_tokens",
		"device_sessions",
		"checkout_requests",
		"users",
	} {
		if _, err := tx.Exec("DELETE FROM " + table); err != nil {
			return fmt.Errorf("wipe %s: %w", table, err)
		}
	}

	for _, realm := range []string{"archive", "collection"} {
		for _, entity := range []string{"item_properties", "attachments", "checkouts", "items", "properties", "locations", "categories", "manufacturers", "suppliers", "vendors"} {
			if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s_%s", realm, entity)); err != nil {
				return fmt.Errorf("wipe %s_%s: %w", realm, entity, err)
			}
		}
	}

	return nil
}

func randomToken(byteCount int) (string, error) {
	b := make([]byte, byteCount)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func encodePropertyValue(v interface{}) string {
	switch raw := v.(type) {
	case string:
		return raw
	case int:
		return fmt.Sprintf("%d", raw)
	case int64:
		return fmt.Sprintf("%d", raw)
	case float64:
		return fmt.Sprintf("%.2f", raw)
	case bool:
		if raw {
			return "true"
		}
		return "false"
	default:
		data, _ := json.Marshal(raw)
		return string(data)
	}
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func nullIfEmpty(v string) interface{} {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func emptyToNil(v string) interface{} {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func defaultCurrency(v string) string {
	if strings.TrimSpace(v) == "" {
		return "EUR"
	}
	return v
}

func lookupOptional(m map[string]int, key string) interface{} {
	if key == "" {
		return nil
	}
	if id, ok := m[key]; ok {
		return id
	}
	return nil
}

func intPtr(v int) *int {
	return &v
}

func demoUsers(adminName, adminEmail string) []userSeed {
	if strings.TrimSpace(adminName) == "" {
		adminName = "Demo Admin"
	}
	if strings.TrimSpace(adminEmail) == "" {
		adminEmail = "admin@itemplus.demo"
	}

	return []userSeed{
		{
			Name:        adminName,
			Email:       adminEmail,
			AppleSub:    "seed_admin_primary",
			IsAdmin:     true,
			IsActive:    true,
			Permissions: []string{},
		},
		{
			Name:     "Jana Becker",
			Email:    "jana@itemplus.demo",
			AppleSub: "seed_manager_jana",
			IsActive: true,
			Permissions: []string{
				"items.read", "items.write", "attachments.write", "checkout.manage", "print",
				"categories.read", "locations.read", "vendors.read",
			},
		},
		{
			Name:     "Mia Hoffmann",
			Email:    "mia@itemplus.demo",
			AppleSub: "seed_member_mia",
			IsActive: true,
			Permissions: []string{
				"items.read", "categories.read", "locations.read", "vendors.read",
			},
		},
		{
			Name:     "Leonie Sommer",
			Email:    "leonie@itemplus.demo",
			AppleSub: "seed_checkout_leonie",
			IsActive: true,
			Permissions: []string{
				"items.read", "categories.read", "locations.read", "vendors.read",
			},
		},
		{
			Name:        "Chris Demo",
			Email:       "chris@itemplus.demo",
			AppleSub:    "seed_pending_chris",
			IsAdmin:     false,
			IsActive:    false,
			Permissions: []string{},
		},
	}
}

func curatedUsers(adminName, adminEmail string) []userSeed {
	if strings.TrimSpace(adminName) == "" {
		adminName = "Demo Admin"
	}
	if strings.TrimSpace(adminEmail) == "" {
		adminEmail = "admin@itemplus.demo"
	}

	return []userSeed{
		{
			Name:        adminName,
			Email:       adminEmail,
			AppleSub:    "seed_admin_primary",
			IsAdmin:     true,
			IsActive:    true,
			Permissions: []string{},
		},
	}
}

func archiveDemo(adminEmail, lang string) realmDataset {
	data := realmDataset{
		Categories: []categorySeed{
			{
				Name:        "Electronics",
				Description: "Boards, single-board computers, and adapters used for prototyping and maintenance work.",
				Color:       "#3b82f6",
				Properties: []propertySeed{
					{Name: "Voltage", Type: "number", Unit: "V", ShowInList: true},
					{Name: "Connector", Type: "select", Options: map[string]interface{}{"choices": []string{"USB-C", "USB-A", "GPIO", "Barrel Jack", "PoE"}}, ShowInList: true},
					{Name: "Power", Type: "number", Unit: "W"},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        "Tools",
				Description: "Hand tools and measuring gear that move between the bench, storage, and onsite jobs.",
				Color:       "#f59e0b",
				Properties: []propertySeed{
					{Name: "Material", Type: "select", Options: map[string]interface{}{"choices": []string{"Steel", "Stainless Steel", "Chrome Vanadium", "Plastic", "Aluminum"}}, ShowInList: true},
					{Name: "Weight", Type: "weight"},
					{Name: "Powered", Type: "boolean", ShowInList: true},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        "3D Printing",
				Description: "Filament and print consumables stocked for repairs, fixtures, and quick prototypes.",
				Color:       "#ef4444",
				Properties: []propertySeed{
					{Name: "Material", Type: "select", Options: map[string]interface{}{"choices": []string{"PLA", "PETG", "ABS", "TPU", "ASA"}}, ShowInList: true},
					{Name: "Diameter", Type: "select", Options: map[string]interface{}{"choices": []string{"1.75mm", "2.85mm"}}, ShowInList: true},
					{Name: "Color", Type: "text", ShowInList: true},
					{Name: "Weight", Type: "weight"},
					{Name: "Priority", Type: "priority", ShowInList: true},
				},
			},
			{
				Name:        "Office Supplies",
				Description: "Shipping labels and administrative supplies used to keep the workspace running.",
				Color:       "#10b981",
				Properties: []propertySeed{
					{Name: "Format", Type: "select", Options: map[string]interface{}{"choices": []string{"A4", "A5", "Label 62x29", "Label 100x150"}}, ShowInList: true},
					{Name: "Color", Type: "text", ShowInList: true},
					{Name: "Priority", Type: "priority", ShowInList: true},
				},
			},
		},
		Locations: []locationSeed{
			{Name: "Workshop", Description: "Main repair and prototyping area with the daily-use benches.", Color: "#f97316", Capacity: intPtr(120)},
			{Name: "Electronics Bench", Parent: "Workshop", Description: "Bench with the power supply, soldering station, and test gear.", Color: "#fb923c", Capacity: intPtr(30)},
			{Name: "Assembly Bench", Parent: "Workshop", Description: "Mechanical assembly space for fixtures, housings, and general repairs.", Color: "#fdba74", Capacity: intPtr(30)},
			{Name: "Supply Storage", Description: "Back stock shelves for adapters, consumables, and print material.", Color: "#22c55e", Capacity: intPtr(200)},
			{Name: "Electronics Shelf", Parent: "Supply Storage", Description: "Spare boards, cables, and adapters kept in labeled bins.", Color: "#4ade80", Capacity: intPtr(60)},
			{Name: "Print Shelf", Parent: "Supply Storage", Description: "Filament and printer consumables organized by material and color.", Color: "#86efac", Capacity: intPtr(60)},
			{Name: "Shipping Desk", Description: "Label rolls, packing supplies, and outgoing paperwork.", Color: "#0ea5e9", Capacity: intPtr(40)},
		},
		Manufacturers: []vendorSeed{
			{Name: "Arduino", Website: "https://arduino.cc"},
			{Name: "Raspberry Pi", Website: "https://www.raspberrypi.com"},
			{Name: "Wera", Website: "https://www.wera.de"},
			{Name: "Fluke", Website: "https://www.fluke.com"},
			{Name: "Prusament", Website: "https://www.prusa3d.com"},
		},
		Suppliers: []vendorSeed{
			{Name: "Mouser", Website: "https://www.mouser.de"},
			{Name: "Reichelt", Website: "https://www.reichelt.de"},
			{Name: "Prusa Research", Website: "https://www.prusa3d.com"},
		},
		Vendors: []vendorSeed{
			{Name: "Conrad", Website: "https://www.conrad.de"},
			{Name: "Amazon Business", Website: "https://www.amazon.de/business"},
			{Name: "3DJake", Website: "https://www.3djake.de"},
		},
		Items: []itemSeed{
			{
				Name:          "Arduino Uno R4 WiFi",
				Description:   "General-purpose controller board used for demos, fixture tests, and quick prototypes.",
				Category:      "Electronics",
				Location:      "Electronics Bench",
				Quantity:      4,
				IsConsumable:  false,
				Manufacturer:  "Arduino",
				Supplier:      "Mouser",
				Vendor:        "Conrad",
				PurchasePrice: 27.90,
				Currency:      "EUR",
				PurchaseDate:  "2025-11-14",
				Properties: map[string]interface{}{
					"Voltage":   5,
					"Connector": "USB-C",
					"Power":     3.5,
					"Condition": "very_good",
				},
				Attachments: []attachmentSeed{
					{Filename: "Arduino Uno R4 WiFi Datasheet", Type: "link", URL: "https://docs.arduino.cc/hardware/uno-r4-wifi/", Note: "Official documentation"},
				},
			},
			{
				Name:          "Raspberry Pi 5 8GB",
				Description:   "Small server and kiosk board kept in reserve for dashboards, camera stations, and signage tests.",
				Category:      "Electronics",
				Location:      "Electronics Shelf",
				Quantity:      2,
				IsConsumable:  false,
				Manufacturer:  "Raspberry Pi",
				Supplier:      "Reichelt",
				Vendor:        "Amazon Business",
				PurchasePrice: 96.00,
				Currency:      "EUR",
				PurchaseDate:  "2026-01-07",
				Properties: map[string]interface{}{
					"Voltage":   5,
					"Connector": "USB-C",
					"Power":     27,
					"Condition": "like_new",
				},
			},
			{
				Name:          "Fluke 117 Multimeter",
				Description:   "Primary True-RMS multimeter used for diagnostics, field service, and incoming checks.",
				Category:      "Tools",
				Location:      "Assembly Bench",
				Quantity:      1,
				IsConsumable:  false,
				Manufacturer:  "Fluke",
				Supplier:      "Reichelt",
				Vendor:        "Amazon Business",
				PurchasePrice: 238.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-09-30",
				Properties: map[string]interface{}{
					"Material":  "Plastic",
					"Weight":    map[string]interface{}{"value": 550, "unit": "g"},
					"Powered":   true,
					"Condition": "very_good",
				},
			},
			{
				Name:          "Wera Kraftform Set",
				Description:   "Bench screwdriver set for small electronics, fixtures, and enclosure work.",
				Category:      "Tools",
				Location:      "Assembly Bench",
				Quantity:      2,
				IsConsumable:  false,
				Manufacturer:  "Wera",
				Supplier:      "Reichelt",
				Vendor:        "Amazon Business",
				PurchasePrice: 42.50,
				Currency:      "EUR",
				PurchaseDate:  "2025-06-22",
				Properties: map[string]interface{}{
					"Material":  "Chrome Vanadium",
					"Weight":    map[string]interface{}{"value": 820, "unit": "g"},
					"Powered":   false,
					"Condition": "good",
				},
			},
			{
				Name:          "PETG Transparent 1kg",
				Description:   "Clear PETG spool used for durable brackets, covers, and workshop fixtures.",
				Category:      "3D Printing",
				Location:      "Print Shelf",
				Quantity:      6,
				IsConsumable:  true,
				MinimumQty:    intPtr(2),
				Manufacturer:  "Prusament",
				Supplier:      "Prusa Research",
				Vendor:        "3DJake",
				PurchasePrice: 29.90,
				Currency:      "EUR",
				PurchaseDate:  "2026-02-05",
				Properties: map[string]interface{}{
					"Material": "PETG",
					"Diameter": "1.75mm",
					"Color":    "Transparent",
					"Weight":   map[string]interface{}{"value": 1000, "unit": "g"},
					"Priority": "medium",
				},
			},
			{
				Name:          "PLA Black 1kg",
				Description:   "Fast everyday filament for test prints, labels, and quick fit checks.",
				Category:      "3D Printing",
				Location:      "Print Shelf",
				Quantity:      1,
				IsConsumable:  true,
				MinimumQty:    intPtr(3),
				Manufacturer:  "Prusament",
				Supplier:      "Prusa Research",
				Vendor:        "3DJake",
				PurchasePrice: 27.90,
				Currency:      "EUR",
				PurchaseDate:  "2026-03-11",
				Properties: map[string]interface{}{
					"Material": "PLA",
					"Diameter": "1.75mm",
					"Color":    "Black",
					"Weight":   map[string]interface{}{"value": 1000, "unit": "g"},
					"Priority": "high",
				},
			},
			{
				Name:          "USB-C Cable 2m 100W",
				Description:   "High-power USB-C cables kept in stock for boards, displays, and power supply tests.",
				Category:      "Electronics",
				Location:      "Electronics Shelf",
				Quantity:      12,
				IsConsumable:  true,
				MinimumQty:    intPtr(4),
				Manufacturer:  "Raspberry Pi",
				Supplier:      "Mouser",
				Vendor:        "Amazon Business",
				PurchasePrice: 9.50,
				Currency:      "EUR",
				PurchaseDate:  "2026-02-20",
				Properties: map[string]interface{}{
					"Voltage":   20,
					"Connector": "USB-C",
					"Power":     100,
					"Condition": "new",
				},
			},
			{
				Name:          "Thermal Labels 100x150",
				Description:   "Thermal shipping and location labels for printers, inventory tags, and packing runs.",
				Category:      "Office Supplies",
				Location:      "Shipping Desk",
				Quantity:      18,
				IsConsumable:  true,
				MinimumQty:    intPtr(6),
				Vendor:        "Amazon Business",
				PurchasePrice: 18.90,
				Currency:      "EUR",
				PurchaseDate:  "2026-01-15",
				Properties: map[string]interface{}{
					"Format":   "Label 100x150",
					"Color":    "White",
					"Priority": "high",
				},
			},
		},
		Checkouts: []checkoutSeed{
			{
				ItemName: "Fluke 117 Multimeter",
				UserMail: "mia@itemplus.demo",
				Status:   "active",
				DueDate:  time.Now().UTC().Add(5 * 24 * time.Hour).Format("2006-01-02"),
				Notes:    "Electrical testing kit for an onsite installation visit",
			},
			{
				ItemName: "Arduino Uno R4 WiFi",
				UserMail: "leonie@itemplus.demo",
				Status:   "returned",
				DueDate:  time.Now().UTC().Add(-6 * 24 * time.Hour).Format("2006-01-02"),
				Returned: time.Now().UTC().Add(-2 * 24 * time.Hour).Format("2006-01-02"),
				Notes:    "Returned after a youth workshop kit was packed down",
			},
		},
		Requests: []requestSeed{
			{
				ItemName:     "Fluke 117 Multimeter",
				UserMail:     "mia@itemplus.demo",
				Status:       "approved",
				DurationDays: intPtr(7),
				ApprovedBy:   "jana@itemplus.demo",
				Notes:        "Needed for a customer site visit and incoming power checks",
			},
			{
				ItemName:     "Arduino Uno R4 WiFi",
				UserMail:     "leonie@itemplus.demo",
				Status:       "completed",
				DurationDays: intPtr(5),
				ApprovedBy:   adminEmail,
				Notes:        "Workshop kit for a local coding session",
			},
			{
				ItemName:     "Wera Kraftform Set",
				UserMail:     "leonie@itemplus.demo",
				Status:       "pending",
				DurationDays: intPtr(3),
				Notes:        "Requested for a short event setup and teardown job",
			},
			{
				ItemName:     "Raspberry Pi 5 8GB",
				UserMail:     "mia@itemplus.demo",
				Status:       "rejected",
				DurationDays: intPtr(14),
				ApprovedBy:   "jana@itemplus.demo",
				Notes:        "Reserved for a permanent kiosk installation and not available",
			},
		},
	}
	if lang == "de" {
		return localizeArchiveGerman(data)
	}
	return data
}

func collectionDemo(adminEmail, lang string) realmDataset {
	data := realmDataset{
		Categories: []categorySeed{
			{
				Name:        "Retro Games",
				Description: "Boxed games, cartridges, and collector editions with condition-focused catalog data.",
				Color:       "#8b5cf6",
				Properties: []propertySeed{
					{Name: "Platform", Type: "select", Options: map[string]interface{}{"choices": []string{"SNES", "N64", "Game Boy", "PS1", "PS2", "Mega Drive"}}, ShowInList: true},
					{Name: "Region", Type: "select", Options: map[string]interface{}{"choices": []string{"PAL", "NTSC-U", "NTSC-J"}}, ShowInList: true},
					{Name: "Complete", Type: "boolean", ShowInList: true},
					{Name: "Age Rating", Type: "age_rating", ShowInList: true},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        "Consoles",
				Description: "Home consoles and handhelds tracked by condition and working status.",
				Color:       "#ec4899",
				Properties: []propertySeed{
					{Name: "Manufacturer", Type: "text", ShowInList: true},
					{Name: "Release Year", Type: "number", ShowInList: true},
					{Name: "Working", Type: "boolean", ShowInList: true},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        "Vinyl",
				Description: "Records catalogued by format, genre, listening rating, and overall condition.",
				Color:       "#14b8a6",
				Properties: []propertySeed{
					{Name: "Format", Type: "select", Options: map[string]interface{}{"choices": []string{"LP", "EP", "7 inch", "12 inch"}}, ShowInList: true},
					{Name: "Genre", Type: "select", Options: map[string]interface{}{"choices": []string{"Rock", "Jazz", "Electronic", "Ambient", "Soundtrack"}}, ShowInList: true},
					{Name: "Rating", Type: "rating", ShowInList: true},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        "Photography",
				Description: "Camera bodies and lenses with mount, weight, and condition details.",
				Color:       "#f97316",
				Properties: []propertySeed{
					{Name: "Mount", Type: "select", Options: map[string]interface{}{"choices": []string{"Canon FD", "Canon EF", "Nikon F", "Sony E", "M42"}}, ShowInList: true},
					{Name: "Weight", Type: "weight"},
					{Name: "Condition", Type: "condition", ShowInList: true},
				},
			},
		},
		Locations: []locationSeed{
			{Name: "Living Room Display Cabinet", Description: "Visible favorite pieces on permanent display.", Color: "#a855f7", Capacity: intPtr(40)},
			{Name: "Top Shelf", Parent: "Living Room Display Cabinet", Description: "Display space for standout consoles and cleaned highlights.", Color: "#c084fc", Capacity: intPtr(12)},
			{Name: "Middle Shelf", Parent: "Living Room Display Cabinet", Description: "Boxed games and compact collector pieces.", Color: "#d8b4fe", Capacity: intPtr(18)},
			{Name: "Media Shelf", Description: "Open shelving for records, larger game boxes, and media hardware.", Color: "#06b6d4", Capacity: intPtr(80)},
			{Name: "Vinyl Section", Parent: "Media Shelf", Description: "Alphabetized record section with listening copies and favorites.", Color: "#67e8f9", Capacity: intPtr(36)},
			{Name: "Studio Shelf", Description: "Camera and audio shelf for active projects and ready-to-grab gear.", Color: "#fb923c", Capacity: intPtr(25)},
			{Name: "Safe", Description: "Protected storage for valuables and fragile collector pieces.", Color: "#64748b", Capacity: intPtr(10)},
		},
		Manufacturers: []vendorSeed{
			{Name: "Nintendo", Website: "https://www.nintendo.com"},
			{Name: "Sony", Website: "https://www.playstation.com"},
			{Name: "Canon", Website: "https://www.canon.de"},
			{Name: "Technics", Website: "https://www.technics.com"},
		},
		Suppliers: []vendorSeed{
			{Name: "eBay", Website: "https://www.ebay.de"},
			{Name: "Discogs", Website: "https://www.discogs.com"},
			{Name: "Kleinanzeigen", Website: "https://www.kleinanzeigen.de"},
		},
		Vendors: []vendorSeed{
			{Name: "Retro Trade", Website: "https://example.com/retro-trade"},
			{Name: "Record Store Day Box", Website: "https://example.com/record-store"},
			{Name: "Local Camera Shop", Website: "https://example.com/camera-shop"},
		},
		Items: []itemSeed{
			{
				Name:          "Super Mario World",
				Description:   "SNES classic with box, insert, and manual stored with the display games.",
				Category:      "Retro Games",
				Location:      "Middle Shelf",
				Quantity:      1,
				Manufacturer:  "Nintendo",
				Supplier:      "eBay",
				Vendor:        "Retro Trade",
				PurchasePrice: 69.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-05-12",
				Properties: map[string]interface{}{
					"Platform":   "SNES",
					"Region":     "PAL",
					"Complete":   true,
					"Age Rating": []string{"usk0"},
					"Condition":  "very_good",
				},
			},
			{
				Name:          "The Legend of Zelda: Ocarina of Time",
				Description:   "N64 collector copy with a clean cartridge and a lightly worn outer box.",
				Category:      "Retro Games",
				Location:      "Middle Shelf",
				Quantity:      1,
				Manufacturer:  "Nintendo",
				Supplier:      "Kleinanzeigen",
				Vendor:        "Retro Trade",
				PurchasePrice: 89.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-09-02",
				Properties: map[string]interface{}{
					"Platform":   "N64",
					"Region":     "PAL",
					"Complete":   true,
					"Age Rating": []string{"usk6"},
					"Condition":  "good",
				},
			},
			{
				Name:          "PlayStation 2 Slim",
				Description:   "Clean slim console with one controller and the original AV cable set.",
				Category:      "Consoles",
				Location:      "Top Shelf",
				Quantity:      1,
				Manufacturer:  "Sony",
				Supplier:      "Kleinanzeigen",
				Vendor:        "Retro Trade",
				PurchasePrice: 75.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-11-18",
				Properties: map[string]interface{}{
					"Manufacturer": "Sony",
					"Release Year": 2004,
					"Working":      true,
					"Condition":    "very_good",
				},
			},
			{
				Name:          "Nintendo 64 Console",
				Description:   "PAL console with Expansion Pak installed and a freshly cleaned shell.",
				Category:      "Consoles",
				Location:      "Top Shelf",
				Quantity:      1,
				Manufacturer:  "Nintendo",
				Supplier:      "eBay",
				Vendor:        "Retro Trade",
				PurchasePrice: 119.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-07-03",
				Properties: map[string]interface{}{
					"Manufacturer": "Nintendo",
					"Release Year": 1997,
					"Working":      true,
					"Condition":    "good",
				},
			},
			{
				Name:          "Dark Side of the Moon",
				Description:   "180g UK reissue stored with the high-rotation listening records.",
				Category:      "Vinyl",
				Location:      "Vinyl Section",
				Quantity:      1,
				Supplier:      "Discogs",
				Vendor:        "Record Store Day Box",
				PurchasePrice: 34.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-03-14",
				Properties: map[string]interface{}{
					"Format":    "LP",
					"Genre":     "Rock",
					"Rating":    5,
					"Condition": "like_new",
				},
			},
			{
				Name:          "Blade Runner 2049 Soundtrack",
				Description:   "Double LP used for listening sessions and quick speaker checks in the media corner.",
				Category:      "Vinyl",
				Location:      "Vinyl Section",
				Quantity:      1,
				Supplier:      "Discogs",
				Vendor:        "Record Store Day Box",
				PurchasePrice: 41.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-08-08",
				Properties: map[string]interface{}{
					"Format":    "LP",
					"Genre":     "Soundtrack",
					"Rating":    4,
					"Condition": "very_good",
				},
			},
			{
				Name:          "Canon AE-1",
				Description:   "Analog camera body with a working light meter, stored with the active project gear.",
				Category:      "Photography",
				Location:      "Studio Shelf",
				Quantity:      1,
				Manufacturer:  "Canon",
				Supplier:      "eBay",
				Vendor:        "Local Camera Shop",
				PurchasePrice: 210.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-04-09",
				Properties: map[string]interface{}{
					"Mount":     "Canon FD",
					"Weight":    map[string]interface{}{"value": 590, "unit": "g"},
					"Condition": "good",
				},
			},
			{
				Name:          "Canon FD 50mm f/1.8",
				Description:   "Compact standard lens stored separately in the safe when it is not mounted.",
				Category:      "Photography",
				Location:      "Safe",
				Quantity:      1,
				Manufacturer:  "Canon",
				Supplier:      "eBay",
				Vendor:        "Local Camera Shop",
				PurchasePrice: 79.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-04-11",
				Properties: map[string]interface{}{
					"Mount":     "Canon FD",
					"Weight":    map[string]interface{}{"value": 170, "unit": "g"},
					"Condition": "very_good",
				},
			},
		},
		Checkouts: []checkoutSeed{
			{
				ItemName: "Canon AE-1",
				UserMail: "mia@itemplus.demo",
				Status:   "active",
				DueDate:  time.Now().UTC().Add(9 * 24 * time.Hour).Format("2006-01-02"),
				Notes:    "Checked out for a weekend magazine shoot",
			},
		},
		Requests: []requestSeed{
			{
				ItemName:     "Canon AE-1",
				UserMail:     "mia@itemplus.demo",
				Status:       "approved",
				DurationDays: intPtr(10),
				ApprovedBy:   adminEmail,
				Notes:        "Reserved for an outdoor production and lens test day",
			},
			{
				ItemName:     "Nintendo 64 Console",
				UserMail:     "leonie@itemplus.demo",
				Status:       "pending",
				DurationDays: intPtr(7),
				Notes:        "Requested for a retro night with a capture setup",
			},
		},
	}
	if lang == "de" {
		return localizeCollectionGerman(data)
	}
	return data
}

func curatedArchive(lang string) realmDataset {
	tr := func(en, de string) string {
		if lang == "de" {
			return de
		}
		return en
	}

	data := realmDataset{
		Categories: []categorySeed{
			{
				Name:        tr("Kitchen Appliances", "Küchengeräte"),
				Description: tr("Everyday countertop appliances tracked like valued household equipment.", "Alltagsgeräte für die Küche, gepflegt wie wertige Haushaltsausstattung."),
				Color:       "#3b82f6",
				Properties: []propertySeed{
					{Name: tr("Color", "Farbe"), Type: "text", ShowInList: true},
					{Name: tr("Power", "Leistung"), Type: "number", Unit: "W", ShowInList: true},
					{Name: tr("Capacity", "Kapazität"), Type: "text", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Beverage Equipment", "Getränkezubehör"),
				Description: tr("Kitchen beverage tools and machines with a small but distinct setup footprint.", "Geräte rund um Getränke und die tägliche Getränkeecke."),
				Color:       "#14b8a6",
				Properties: []propertySeed{
					{Name: tr("Color", "Farbe"), Type: "text", ShowInList: true},
					{Name: tr("Included accessories", "Zubehör"), Type: "textblock"},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Kitchen Tools", "Küchenwerkzeuge"),
				Description: tr("Higher-value kitchen tools that are worth cataloging individually.", "Wertige Küchenwerkzeuge, die sich als Einzelstücke im Inventar lohnen."),
				Color:       "#f97316",
				Properties: []propertySeed{
					{Name: tr("Material", "Material"), Type: "text", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Sharpened recently", "Kürzlich geschärft"), Type: "boolean", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Kitchen Storage", "Küchenorganisation"),
				Description: tr("Visible kitchen storage and organization pieces that shape the room.", "Sichtbare Küchenorganisation und Aufbewahrung mit echtem Nutzwert."),
				Color:       "#a855f7",
				Properties: []propertySeed{
					{Name: tr("Material", "Material"), Type: "text", ShowInList: true},
					{Name: tr("Capacity", "Kapazität"), Type: "text", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Office Electronics", "Büroelektronik"),
				Description: tr("Core desk-side electronics used day to day in the workspace.", "Zentrale Büroelektronik für den täglichen Arbeitsplatz."),
				Color:       "#2563eb",
				Properties: []propertySeed{
					{Name: tr("Storage", "Speicher"), Type: "text", ShowInList: true},
					{Name: tr("Connectivity", "Konnektivität"), Type: "text", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Storage Media", "Speichermedien"),
				Description: tr("Portable media and handoff storage for small office workflows.", "Tragbare Speichermedien für Transfer, Übergaben und kleine Büroabläufe."),
				Color:       "#0ea5e9",
				Properties: []propertySeed{
					{Name: tr("Capacity", "Kapazität"), Type: "text", ShowInList: true},
					{Name: tr("Connector", "Anschluss"), Type: "text", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Network Equipment", "Netzwerktechnik"),
				Description: tr("Desk-side network gear and shared infrastructure hardware.", "Kleine Netzwerk-Hardware und gemeinsame Infrastruktur im Büro."),
				Color:       "#0284c7",
				Properties: []propertySeed{
					{Name: tr("Ports", "Ports"), Type: "number", ShowInList: true},
					{Name: tr("Managed", "Managed"), Type: "boolean", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Office Lighting", "Bürobeleuchtung"),
				Description: tr("Task lighting that supports long desk sessions and evening work.", "Arbeitsbeleuchtung für lange Schreibtisch-Sessions und Abendstunden."),
				Color:       "#eab308",
				Properties: []propertySeed{
					{Name: tr("Lamp type", "Lampentyp"), Type: "text", ShowInList: true},
					{Name: tr("Dimmable", "Dimmbar"), Type: "boolean", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Storage Systems", "Speichersysteme"),
				Description: tr("Shared storage systems and structured local infrastructure.", "Gemeinsame Speichersysteme und lokale Infrastruktur mit Dauerbetrieb."),
				Color:       "#0891b2",
				Properties: []propertySeed{
					{Name: tr("Bays", "Einschübe"), Type: "number", ShowInList: true},
					{Name: tr("Network", "Netzwerk"), Type: "text", ShowInList: true},
					{Name: tr("Expandable", "Erweiterbar"), Type: "boolean", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Office Equipment", "Bürotechnik"),
				Description: tr("Paper handling and output devices in the office workflow.", "Geräte für Papier, Scans und Ausgaben im Büroalltag."),
				Color:       "#6366f1",
				Properties: []propertySeed{
					{Name: tr("Connectivity", "Konnektivität"), Type: "text", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Power Tools", "Elektrowerkzeuge"),
				Description: tr("Cordless tools for fitting, assembly, and everyday workshop use.", "Akkubetriebene Werkzeuge für Montage, Einbau und Werkstattalltag."),
				Color:       "#f59e0b",
				Properties: []propertySeed{
					{Name: tr("Power source", "Energiequelle"), Type: "text", ShowInList: true},
					{Name: tr("Voltage", "Spannung"), Type: "number", Unit: "V", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Tool Accessories", "Werkzeugzubehör"),
				Description: tr("Compact workshop accessory sets and quick-grab inserts.", "Kompaktes Zubehör und schnell greifbare Einsätze für die Werkstatt."),
				Color:       "#fb923c",
				Properties: []propertySeed{
					{Name: tr("Material", "Material"), Type: "text", ShowInList: true},
					{Name: tr("Capacity", "Kapazität"), Type: "text", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Measuring Tools", "Messwerkzeuge"),
				Description: tr("Measurement and diagnostics tools for accurate work and troubleshooting.", "Mess- und Diagnosewerkzeuge für präzises Arbeiten und Fehlersuche."),
				Color:       "#22c55e",
				Properties: []propertySeed{
					{Name: tr("Tool type", "Werkzeugtyp"), Type: "text", ShowInList: true},
					{Name: tr("Connectivity", "Konnektivität"), Type: "text"},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Tool Storage", "Werkzeugaufbewahrung"),
				Description: tr("Cases and mobile storage for organized workshop travel.", "Koffer und mobile Aufbewahrung für Ordnung und Außeneinsätze."),
				Color:       "#84cc16",
				Properties: []propertySeed{
					{Name: tr("Material", "Material"), Type: "text", ShowInList: true},
					{Name: tr("Lockable", "Abschließbar"), Type: "boolean", ShowInList: true},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Electronics Tools", "Elektronikwerkzeuge"),
				Description: tr("Fine electronics equipment for soldering, prototyping, and repair.", "Feinwerkzeuge für Löten, Prototyping und Reparatur."),
				Color:       "#f43f5e",
				Properties: []propertySeed{
					{Name: tr("Power", "Leistung"), Type: "number", Unit: "W", ShowInList: true},
					{Name: tr("ESD safe", "ESD-sicher"), Type: "boolean", ShowInList: true},
					{Name: tr("Tool type", "Werkzeugtyp"), Type: "text"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("3D Printing", "3D-Druck"),
				Description: tr("3D printers and fabrication equipment for prototypes and fixtures.", "3D-Drucker und Fertigungstechnik für Prototypen und Halterungen."),
				Color:       "#ef4444",
				Properties: []propertySeed{
					{Name: tr("Build volume", "Bauraum"), Type: "text", ShowInList: true},
					{Name: tr("Connectivity", "Konnektivität"), Type: "text"},
					{Name: tr("Weight", "Gewicht"), Type: "weight"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
		},
		Locations: []locationSeed{
			{Name: tr("Kitchen", "Küche"), Description: tr("Warm everyday kitchen with a few well-chosen appliances and storage pieces.", "Warme Alltagsküche mit ausgewählten Geräten und sichtbarer Ordnung."), Color: "#60a5fa", Capacity: intPtr(60)},
			{Name: tr("Countertop", "Arbeitsplatte"), Parent: tr("Kitchen", "Küche"), Description: tr("Visible daily-use surface for small appliances and spice storage.", "Sichtbare Nutzfläche für kleine Geräte und Gewürze."), Color: "#93c5fd", Capacity: intPtr(12)},
			{Name: tr("Appliance Shelf", "Geräteregal"), Parent: tr("Kitchen", "Küche"), Description: tr("Shelf space for larger kitchen machines kept close at hand.", "Regalplatz für größere Küchengeräte im schnellen Zugriff."), Color: "#bfdbfe", Capacity: intPtr(10)},
			{Name: tr("Pantry Cabinet", "Vorratsschrank Küche"), Parent: tr("Kitchen", "Küche"), Description: tr("Closed storage for larger appliances and pantry organization pieces.", "Geschlossener Stauraum für größere Geräte und Vorratsorganisation."), Color: "#dbeafe", Capacity: intPtr(16)},
			{Name: tr("Knife Drawer", "Messerschublade"), Parent: tr("Kitchen", "Küche"), Description: tr("Protected storage for kitchen knives and prep tools.", "Geschützter Platz für Messer und Vorbereitungswerkzeuge."), Color: "#e0f2fe", Capacity: intPtr(8)},
			{Name: tr("Beverage Corner", "Getränkeecke"), Parent: tr("Kitchen", "Küche"), Description: tr("Tea, coffee, and sparkling water setup in daily use.", "Ecke für Tee, Kaffee und Sprudelwasser im täglichen Einsatz."), Color: "#99f6e4", Capacity: intPtr(8)},
			{Name: tr("Office", "Büro"), Description: tr("Calm workspace with storage, scanning, printing, and a few personal tech items.", "Ruhiger Arbeitsplatz mit Speicher, Scan- und Drucktechnik sowie ein paar persönlichen Tech-Geräten."), Color: "#2563eb", Capacity: intPtr(80)},
			{Name: tr("Main Desk", "Hauptschreibtisch"), Parent: tr("Office", "Büro"), Description: tr("Primary workstation for focused desk work.", "Hauptarbeitsplatz für konzentrierte Schreibtischarbeit."), Color: "#60a5fa", Capacity: intPtr(12)},
			{Name: tr("Sideboard", "Sideboard"), Parent: tr("Office", "Büro"), Description: tr("Side surface for devices that are used often but not constantly.", "Seitliche Ablage für Geräte mit regelmäßigem, aber nicht permanentem Einsatz."), Color: "#93c5fd", Capacity: intPtr(10)},
			{Name: tr("Network Shelf", "Netzwerkregal"), Parent: tr("Office", "Büro"), Description: tr("Shared storage and small-network corner.", "Ecke für gemeinsames Storage und kleine Netzwerktechnik."), Color: "#bfdbfe", Capacity: intPtr(10)},
			{Name: tr("Scanner Station", "Scannerplatz"), Parent: tr("Office", "Büro"), Description: tr("Paper intake, scanning, and document prep zone.", "Platz für Papiererfassung, Scans und Dokumentenvorbereitung."), Color: "#dbeafe", Capacity: intPtr(8)},
			{Name: tr("Print Corner", "Druckerecke"), Parent: tr("Office", "Büro"), Description: tr("Printer and output area for shipping and office paperwork.", "Druckbereich für Versand, Etiketten und Bürodokumente."), Color: "#e0e7ff", Capacity: intPtr(8)},
			{Name: tr("Workshop", "Werkstatt"), Description: tr("Organized workshop with fabrication, soldering, measuring, and assembly zones.", "Organisierte Werkstatt mit Bereichen für Fertigung, Löten, Messen und Montage."), Color: "#f97316", Capacity: intPtr(120)},
			{Name: tr("Main Workbench", "Hauptwerkbank"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Core work surface for fitting, assembly, and cutting tasks.", "Zentrale Arbeitsfläche für Montage, Zuschnitt und Einpassungen."), Color: "#fb923c", Capacity: intPtr(18)},
			{Name: tr("Tool Cabinet", "Werkzeugschrank"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Sorted accessories and quick-grab workshop inserts.", "Sortiertes Zubehör und schnell griffbereite Einsätze."), Color: "#fdba74", Capacity: intPtr(18)},
			{Name: tr("Measurement Shelf", "Messregal"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Protected shelf for measuring and diagnostic tools.", "Geschütztes Regal für Mess- und Diagnosewerkzeuge."), Color: "#fde68a", Capacity: intPtr(12)},
			{Name: tr("Soldering Station", "Lötplatz"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Electronics bench for fine soldering and prototyping work.", "Elektronikplatz für feine Lötarbeiten und Prototyping."), Color: "#fca5a5", Capacity: intPtr(12)},
			{Name: tr("3D Print Corner", "3D-Druck-Ecke"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Fabrication area for prints, fixtures, and workshop helpers.", "Fertigungsbereich für Druckteile, Halterungen und Werkstatthelfer."), Color: "#fda4af", Capacity: intPtr(14)},
			{Name: tr("Mobile Tool Case", "Mobiler Werkzeugkoffer"), Parent: tr("Workshop", "Werkstatt"), Description: tr("Storage for travel-ready tools and sorted inserts.", "Aufbewahrung für mobile Werkzeuge und sortierte Einsätze."), Color: "#fdba74", Capacity: intPtr(10)},
		},
		Vendors: []vendorSeed{
			{Name: "Amazon", Website: "https://www.amazon.de"},
			{Name: "Office Partner", Website: "https://www.office-partner.de"},
			{Name: "IKEA", Website: "https://www.ikea.com"},
			{Name: "Retro Trade"},
			{Name: "Cardmarket", Website: "https://www.cardmarket.com"},
		},
		Items: []itemSeed{
			{
				Name:          tr("Bosch Kitchen Machine Serie 4 MUM58200", "Bosch Küchenmaschine Serie 4 MUM58200"),
				Description:   tr("Stand mixer for dough, batters, creams, and everyday baking prep.", "Küchenmaschine für Teige, Cremes und alltägliche Backvorbereitung."),
				Category:      tr("Kitchen Appliances", "Küchengeräte"),
				Location:      tr("Appliance Shelf", "Geräteregal"),
				Quantity:      1,
				Manufacturer:  "Bosch",
				Vendor:        "Amazon",
				PurchasePrice: 169.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-12-08",
				Properties: map[string]interface{}{
					tr("Color", "Farbe"):        tr("White / Silver", "Weiß / Silber"),
					tr("Power", "Leistung"):     1000,
					tr("Capacity", "Kapazität"): "3.9 L",
					tr("Weight", "Gewicht"):     map[string]interface{}{"value": 5500, "unit": "g"},
					tr("Condition", "Zustand"):  "very_good",
				},
			},
			{
				Name:          tr("Braun MultiQuick Hand Blender", "Braun MultiQuick Stabmixer"),
				Description:   tr("Everyday immersion blender used for soups, sauces, and quick kitchen prep.", "Alltags-Stabmixer für Suppen, Saucen und schnelle Küchenvorbereitung."),
				Category:      tr("Kitchen Appliances", "Küchengeräte"),
				Location:      tr("Countertop", "Arbeitsplatte"),
				Quantity:      1,
				Manufacturer:  "Braun",
				Vendor:        "Amazon",
				PurchasePrice: 64.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-09-22",
				Properties: map[string]interface{}{
					tr("Color", "Farbe"):        tr("Black / Stainless steel", "Schwarz / Edelstahl"),
					tr("Power", "Leistung"):     1000,
					tr("Capacity", "Kapazität"): tr("Beaker included", "Messbecher inklusive"),
					tr("Weight", "Gewicht"):     map[string]interface{}{"value": 900, "unit": "g"},
					tr("Condition", "Zustand"):  "good",
				},
			},
			{
				Name:          tr("WMF Stelio Kettle", "WMF Stelio Wasserkocher"),
				Description:   tr("Stainless steel electric kettle used daily for tea, coffee, and quick hot water prep.", "Edelstahl-Wasserkocher für Tee, Kaffee und heißes Wasser im Alltag."),
				Category:      tr("Kitchen Appliances", "Küchengeräte"),
				Location:      tr("Beverage Corner", "Getränkeecke"),
				Quantity:      1,
				Manufacturer:  "WMF",
				Vendor:        "Amazon",
				PurchasePrice: 49.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-10-05",
				Properties: map[string]interface{}{
					tr("Color", "Farbe"):        tr("Stainless steel / Black", "Edelstahl / Schwarz"),
					tr("Power", "Leistung"):     2400,
					tr("Capacity", "Kapazität"): "1.7 L",
					tr("Weight", "Gewicht"):     map[string]interface{}{"value": 1300, "unit": "g"},
					tr("Condition", "Zustand"):  "very_good",
				},
			},
			{
				Name:          tr("SodaStream Terra", "SodaStream Terra"),
				Description:   tr("Sparkling water maker with quick-connect cylinder and reusable bottles.", "Wassersprudler mit Quick-Connect-Zylinder und wiederverwendbaren Flaschen."),
				Category:      tr("Beverage Equipment", "Getränkezubehör"),
				Location:      tr("Beverage Corner", "Getränkeecke"),
				Quantity:      1,
				Manufacturer:  "SodaStream",
				Vendor:        "Amazon",
				PurchasePrice: 79.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-11-02",
				Properties: map[string]interface{}{
					tr("Color", "Farbe"):                  tr("Black", "Schwarz"),
					tr("Included accessories", "Zubehör"): tr("Two bottles, CO2 cylinder", "Zwei Flaschen, CO2-Zylinder"),
					tr("Weight", "Gewicht"):               map[string]interface{}{"value": 1900, "unit": "g"},
					tr("Condition", "Zustand"):            "good",
				},
			},
			{
				Name:          tr("Zwilling Pro Chef's Knife 20 cm", "Zwilling Pro Kochmesser 20 cm"),
				Description:   tr("Primary chef's knife for vegetables, herbs, and general prep work.", "Hauptkochmesser für Gemüse, Kräuter und allgemeine Vorbereitung."),
				Category:      tr("Kitchen Tools", "Küchenwerkzeuge"),
				Location:      tr("Knife Drawer", "Messerschublade"),
				Quantity:      1,
				Manufacturer:  "Zwilling",
				Vendor:        "Amazon",
				PurchasePrice: 89.95,
				Currency:      "EUR",
				PurchaseDate:  "2025-08-12",
				Properties: map[string]interface{}{
					tr("Material", "Material"):                     tr("Stainless steel", "Edelstahl"),
					tr("Weight", "Gewicht"):                        map[string]interface{}{"value": 280, "unit": "g"},
					tr("Sharpened recently", "Kürzlich geschärft"): true,
					tr("Condition", "Zustand"):                     "very_good",
				},
			},
			{
				Name:          tr("Tefal OptiGrill", "Tefal OptiGrill"),
				Description:   tr("Contact grill for sandwiches, vegetables, and quick indoor grilling.", "Kontaktgrill für Sandwiches, Gemüse und schnelles Indoor-Grillen."),
				Category:      tr("Kitchen Appliances", "Küchengeräte"),
				Location:      tr("Pantry Cabinet", "Vorratsschrank Küche"),
				Quantity:      1,
				Manufacturer:  "Tefal",
				Vendor:        "Amazon",
				PurchasePrice: 179.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-07-20",
				Properties: map[string]interface{}{
					tr("Color", "Farbe"):        tr("Black / Stainless steel", "Schwarz / Edelstahl"),
					tr("Power", "Leistung"):     2000,
					tr("Capacity", "Kapazität"): tr("6 automatic programs", "6 Automatikprogramme"),
					tr("Weight", "Gewicht"):     map[string]interface{}{"value": 4800, "unit": "g"},
					tr("Condition", "Zustand"):  "good",
				},
			},
			{
				Name:          tr("IKEA KORKEN Storage Jar Set", "IKEA KORKEN Vorratsgläser Set"),
				Description:   tr("Glass storage jars used for pasta, rice, flour, and dry pantry goods.", "Vorratsgläser für Pasta, Reis, Mehl und trockene Küchenvorräte."),
				Category:      tr("Kitchen Storage", "Küchenorganisation"),
				Location:      tr("Pantry Cabinet", "Vorratsschrank Küche"),
				Quantity:      1,
				Vendor:        "Amazon",
				PurchasePrice: 24.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-06-15",
				Properties: map[string]interface{}{
					tr("Material", "Material"):  tr("Glass", "Glas"),
					tr("Capacity", "Kapazität"): tr("4 jars", "4 Gläser"),
					tr("Condition", "Zustand"):  "very_good",
				},
			},
			{
				Name:          tr("Bamboo Spice Rack", "Bambus Gewürzregal"),
				Description:   tr("Open countertop spice rack for frequently used seasonings and blends.", "Offenes Gewürzregal für häufig genutzte Gewürze und Mischungen."),
				Category:      tr("Kitchen Storage", "Küchenorganisation"),
				Location:      tr("Countertop", "Arbeitsplatte"),
				Quantity:      1,
				Vendor:        "Amazon",
				PurchasePrice: 29.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-08-02",
				Properties: map[string]interface{}{
					tr("Material", "Material"):  tr("Bamboo", "Bambus"),
					tr("Capacity", "Kapazität"): tr("12 jars", "12 Gläser"),
					tr("Condition", "Zustand"):  "good",
				},
			},
			{
				Name:          tr("Apple iMac 24-inch", "Apple iMac 24 Zoll"),
				Description:   tr("Primary desktop workstation for administration, media tasks, and daily office work.", "Primärer Desktop-Arbeitsplatz für Verwaltung, Medienarbeit und täglichen Büroeinsatz."),
				Category:      tr("Office Electronics", "Büroelektronik"),
				Location:      tr("Main Desk", "Hauptschreibtisch"),
				Quantity:      1,
				Manufacturer:  "Apple",
				Vendor:        "Amazon",
				PurchasePrice: 1799.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-05-06",
				Properties: map[string]interface{}{
					tr("Storage", "Speicher"):           "512 GB SSD",
					tr("Connectivity", "Konnektivität"): tr("Wi-Fi, Bluetooth, USB-C", "WLAN, Bluetooth, USB-C"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 4500, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("SanDisk USB Flash Drive", "SanDisk USB-Stick"),
				Description:   tr("Portable USB drive for quick file transfers and firmware packages.", "Tragbarer USB-Stick für schnelle Dateiübertragungen und Firmware-Pakete."),
				Category:      tr("Storage Media", "Speichermedien"),
				Location:      tr("Main Desk", "Hauptschreibtisch"),
				Quantity:      1,
				Manufacturer:  "SanDisk",
				Vendor:        "Amazon",
				PurchasePrice: 18.99,
				Currency:      "EUR",
				PurchaseDate:  "2026-01-16",
				Properties: map[string]interface{}{
					tr("Capacity", "Kapazität"):  "128 GB",
					tr("Connector", "Anschluss"): "USB-A",
					tr("Condition", "Zustand"):   "good",
				},
			},
			{
				Name:          tr("Valve Steam Deck", "Valve Steam Deck"),
				Description:   tr("Handheld gaming and testing device stored in the office media area.", "Handheld für Gaming und kleine Testläufe im Bürobereich."),
				Category:      tr("Office Electronics", "Büroelektronik"),
				Location:      tr("Sideboard", "Sideboard"),
				Quantity:      1,
				Manufacturer:  "Valve",
				Vendor:        "Amazon",
				PurchasePrice: 569.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-12-20",
				Properties: map[string]interface{}{
					tr("Storage", "Speicher"):           "512 GB",
					tr("Connectivity", "Konnektivität"): tr("USB-C, Wi-Fi, Bluetooth", "USB-C, WLAN, Bluetooth"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 670, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("Cisco 8-Port Switch", "Cisco 8-Port Switch"),
				Description:   tr("Compact network switch for desk-side connectivity and NAS access.", "Kompakter Netzwerkswitch für Arbeitsplatz, NAS und Drucker-Anbindung."),
				Category:      tr("Network Equipment", "Netzwerktechnik"),
				Location:      tr("Network Shelf", "Netzwerkregal"),
				Quantity:      1,
				Manufacturer:  "Cisco",
				Vendor:        "Amazon",
				PurchasePrice: 64.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-10-10",
				Properties: map[string]interface{}{
					tr("Ports", "Ports"):       8,
					tr("Managed", "Managed"):   false,
					tr("Condition", "Zustand"): "good",
				},
			},
			{
				Name:          tr("Dyson Task Lamp", "Dyson Tischlampe"),
				Description:   tr("Adjustable desk lamp for reading, editing, and longer evening sessions.", "Verstellbare Tischlampe für Lesen, Bearbeitung und längere Abendsessions."),
				Category:      tr("Office Lighting", "Bürobeleuchtung"),
				Location:      tr("Main Desk", "Hauptschreibtisch"),
				Quantity:      1,
				Manufacturer:  "Dyson",
				Vendor:        "Amazon",
				PurchasePrice: 499.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-11-18",
				Properties: map[string]interface{}{
					tr("Lamp type", "Lampentyp"): tr("Desk lamp", "Tischlampe"),
					tr("Dimmable", "Dimmbar"):    true,
					tr("Condition", "Zustand"):   "very_good",
				},
			},
			{
				Name:          tr("Synology Desktop NAS", "Synology Desktop NAS"),
				Description:   tr("Shared storage system for documents, media, backups, and internal project files.", "Gemeinsames Speichersystem für Dokumente, Medien, Backups und Projektdateien."),
				Category:      tr("Storage Systems", "Speichersysteme"),
				Location:      tr("Network Shelf", "Netzwerkregal"),
				Quantity:      1,
				Manufacturer:  "Synology",
				Vendor:        "Amazon",
				PurchasePrice: 649.00,
				Currency:      "EUR",
				PurchaseDate:  "2026-02-02",
				Properties: map[string]interface{}{
					tr("Bays", "Einschübe"):         4,
					tr("Network", "Netzwerk"):       "1 GbE",
					tr("Expandable", "Erweiterbar"): true,
					tr("Condition", "Zustand"):      "very_good",
				},
			},
			{
				Name:          tr("Brother Document Scanner ADS-4700W", "Brother Dokumentenscanner ADS-4700W"),
				Description:   tr("Fast document scanner for receipts, contracts, and archive intake.", "Schneller Dokumentenscanner für Belege, Verträge und Archiv-Erfassung."),
				Category:      tr("Office Equipment", "Bürotechnik"),
				Location:      tr("Scanner Station", "Scannerplatz"),
				Quantity:      1,
				Manufacturer:  "Brother",
				Vendor:        "Amazon",
				PurchasePrice: 529.00,
				Currency:      "EUR",
				PurchaseDate:  "2026-01-09",
				Properties: map[string]interface{}{
					tr("Connectivity", "Konnektivität"): tr("USB, LAN, Wi-Fi", "USB, LAN, WLAN"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 2750, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("Brother Laser Printer", "Brother Laserdrucker"),
				Description:   tr("Compact color multifunction laser printer for labels, scans, and office documents.", "Kompakter Farb-Multifunktions-Laserdrucker für Etiketten, Scans und Bürodokumente."),
				Category:      tr("Office Equipment", "Bürotechnik"),
				Location:      tr("Print Corner", "Druckerecke"),
				Quantity:      1,
				Manufacturer:  "Brother",
				Vendor:        "Amazon",
				PurchasePrice: 249.00,
				Currency:      "EUR",
				PurchaseDate:  "2026-01-09",
				Properties: map[string]interface{}{
					tr("Connectivity", "Konnektivität"): tr("USB, Wi-Fi, Ethernet", "USB, WLAN, Ethernet"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 18000, "unit": "g"},
					tr("Condition", "Zustand"):          "good",
				},
			},
			{
				Name:          tr("Festool TXS 18-Basic-Set", "Festool TXS 18-Basic-Set"),
				Description:   tr("Compact cordless drill driver for furniture assembly and precise screw work.", "Kompakter Akkuschrauber für Möbelaufbau und präzise Schraubarbeiten."),
				Category:      tr("Power Tools", "Elektrowerkzeuge"),
				Location:      tr("Main Workbench", "Hauptwerkbank"),
				Quantity:      1,
				Manufacturer:  "Festool",
				Vendor:        "Amazon",
				PurchasePrice: 229.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-09-14",
				Properties: map[string]interface{}{
					tr("Power source", "Energiequelle"): tr("Battery", "Akku"),
					tr("Voltage", "Spannung"):           18,
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 900, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("Wera Bit-Check", "Wera Bit-Check"),
				Description:   tr("Compact bit assortment for the most common screw heads and workshop fixes.", "Kompakte Bit-Sammlung für die häufigsten Schraubprofile und schnelle Werkstattaufgaben."),
				Category:      tr("Tool Accessories", "Werkzeugzubehör"),
				Location:      tr("Tool Cabinet", "Werkzeugschrank"),
				Quantity:      1,
				Manufacturer:  "Wera",
				Vendor:        "Amazon",
				PurchasePrice: 34.99,
				Currency:      "EUR",
				PurchaseDate:  "2025-07-07",
				Properties: map[string]interface{}{
					tr("Material", "Material"):  tr("Steel / plastic", "Stahl / Kunststoff"),
					tr("Capacity", "Kapazität"): tr("12 bits", "12 Bits"),
					tr("Condition", "Zustand"):  "very_good",
				},
			},
			{
				Name:          tr("Leica DISTO S910", "Leica DISTO S910"),
				Description:   tr("High-end laser distance meter for room measurement and precise planning.", "Hochwertiger Laserdistanzmesser für Raumaufmaß und präzise Planung."),
				Category:      tr("Measuring Tools", "Messwerkzeuge"),
				Location:      tr("Measurement Shelf", "Messregal"),
				Quantity:      1,
				Manufacturer:  "Leica",
				Vendor:        "Amazon",
				PurchasePrice: 1399.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-06-19",
				Properties: map[string]interface{}{
					tr("Tool type", "Werkzeugtyp"):      tr("Laser distance meter", "Laserdistanzmesser"),
					tr("Connectivity", "Konnektivität"): tr("Bluetooth, USB", "Bluetooth, USB"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 290, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("Wurth Tool Case", "Wurth Werkzeugkoffer"),
				Description:   tr("Rugged empty tool case for mobile jobs and sorted inserts.", "Robuster leerer Werkzeugkoffer für mobile Einsätze und sortierte Einlagen."),
				Category:      tr("Tool Storage", "Werkzeugaufbewahrung"),
				Location:      tr("Mobile Tool Case", "Mobiler Werkzeugkoffer"),
				Quantity:      1,
				Manufacturer:  "Wurth",
				Vendor:        "Amazon",
				PurchasePrice: 119.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-05-12",
				Properties: map[string]interface{}{
					tr("Material", "Material"):     tr("Plastic / aluminum", "Kunststoff / Aluminium"),
					tr("Lockable", "Abschließbar"): true,
					tr("Weight", "Gewicht"):        map[string]interface{}{"value": 4200, "unit": "g"},
					tr("Condition", "Zustand"):     "good",
				},
			},
			{
				Name:          tr("ERSA i-CON 1 MK2 ESD", "ERSA i-CON 1 MK2 ESD"),
				Description:   tr("Professional soldering station for fine electronics repair and prototyping.", "Professionelle Lötstation für feine Elektronikreparatur und Prototyping."),
				Category:      tr("Electronics Tools", "Elektronikwerkzeuge"),
				Location:      tr("Soldering Station", "Lötplatz"),
				Quantity:      1,
				Manufacturer:  "ERSA",
				Vendor:        "Amazon",
				PurchasePrice: 329.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-04-16",
				Properties: map[string]interface{}{
					tr("Power", "Leistung"):        80,
					tr("ESD safe", "ESD-sicher"):   true,
					tr("Tool type", "Werkzeugtyp"): tr("Soldering station", "Lötstation"),
					tr("Condition", "Zustand"):     "very_good",
				},
			},
			{
				Name:          tr("Ultimaker 3", "Ultimaker 3"),
				Description:   tr("Dual-extrusion 3D printer used for prototypes, fixtures, and repair parts.", "Dual-Extrusion-3D-Drucker für Prototypen, Halterungen und Ersatzteile."),
				Category:      tr("3D Printing", "3D-Druck"),
				Location:      tr("3D Print Corner", "3D-Druck-Ecke"),
				Quantity:      1,
				Manufacturer:  "Ultimaker",
				Vendor:        "Amazon",
				PurchasePrice: 1890.00,
				Currency:      "EUR",
				PurchaseDate:  "2024-12-11",
				Properties: map[string]interface{}{
					tr("Build volume", "Bauraum"):       tr("215 x 215 x 200 mm", "215 x 215 x 200 mm"),
					tr("Connectivity", "Konnektivität"): tr("Wi-Fi, Ethernet, USB", "WLAN, Ethernet, USB"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 10600, "unit": "g"},
					tr("Condition", "Zustand"):          "good",
				},
			},
			{
				Name:          tr("Fluke 289", "Fluke 289"),
				Description:   tr("Logging multimeter for electrical diagnostics and detailed measurements.", "Datenlogger-Multimeter für elektrische Diagnose und detaillierte Messungen."),
				Category:      tr("Measuring Tools", "Messwerkzeuge"),
				Location:      tr("Measurement Shelf", "Messregal"),
				Quantity:      1,
				Manufacturer:  "Fluke",
				Vendor:        "Amazon",
				PurchasePrice: 749.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-03-03",
				Properties: map[string]interface{}{
					tr("Tool type", "Werkzeugtyp"):      tr("Digital multimeter", "Digitalmultimeter"),
					tr("Connectivity", "Konnektivität"): tr("Local logging", "Lokales Logging"),
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 870, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
			{
				Name:          tr("Festool PSC-E 18 EB-Basic", "Festool PSC-E 18 EB-Basic"),
				Description:   tr("Cordless jigsaw for curved cuts, sheet work, and precise fitting tasks.", "Akku-Stichsäge für Kurvenschnitte, Plattenarbeit und präzise Anpassungen."),
				Category:      tr("Power Tools", "Elektrowerkzeuge"),
				Location:      tr("Main Workbench", "Hauptwerkbank"),
				Quantity:      1,
				Manufacturer:  "Festool",
				Vendor:        "Amazon",
				PurchasePrice: 349.00,
				Currency:      "EUR",
				PurchaseDate:  "2025-08-28",
				Properties: map[string]interface{}{
					tr("Power source", "Energiequelle"): tr("Battery", "Akku"),
					tr("Voltage", "Spannung"):           18,
					tr("Weight", "Gewicht"):             map[string]interface{}{"value": 1700, "unit": "g"},
					tr("Condition", "Zustand"):          "very_good",
				},
			},
		},
		Checkouts: []checkoutSeed{},
		Requests:  []requestSeed{},
	}

	return data
}

func curatedCollection(adminEmail, lang string) realmDataset {
	tr := func(en, de string) string {
		if lang == "de" {
			return de
		}
		return en
	}

	data := realmDataset{
		Categories: []categorySeed{
			{
				Name:        tr("Trading Card Games", "Sammelkarten"),
				Description: tr("Curated card collection items with condition, set, grading, and storage metadata.", "Kuratierte Sammelkarten mit Zustands-, Set-, Grading- und Storage-Daten."),
				Color:       "#ec4899",
				Properties: []propertySeed{
					{Name: tr("Set", "Set"), Type: "text", ShowInList: true},
					{Name: tr("Language", "Sprache"), Type: "text", ShowInList: true},
					{Name: tr("Rarity", "Seltenheit"), Type: "text"},
					{Name: tr("Sealed", "Versiegelt"), Type: "boolean", ShowInList: true},
					{Name: tr("Graded", "Gegradet"), Type: "boolean", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Trading Card Storage", "Kartenaufbewahrung"),
				Description: tr("Binders, boxes, and protective storage for collector cards.", "Binder, Boxen und Schutzaufbewahrung für Sammlerkarten."),
				Color:       "#d946ef",
				Properties: []propertySeed{
					{Name: tr("Material", "Material"), Type: "text", ShowInList: true},
					{Name: tr("Capacity", "Kapazität"), Type: "text", ShowInList: true},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Retro Games", "Retrospiele"),
				Description: tr("Recognizable boxed and cartridge-based classics for a warm collector shelf.", "Bekannte Klassiker als Module und Boxen für ein warmes Sammlerregal."),
				Color:       "#8b5cf6",
				Properties: []propertySeed{
					{Name: tr("Platform", "Plattform"), Type: "text", ShowInList: true},
					{Name: tr("Region", "Region"), Type: "text", ShowInList: true},
					{Name: tr("Release year", "Erscheinungsjahr"), Type: "number", ShowInList: true},
					{Name: tr("Complete in box", "Komplett in Box"), Type: "boolean", ShowInList: true},
					{Name: tr("Manual included", "Anleitung enthalten"), Type: "boolean", ShowInList: true},
					{Name: tr("Publisher", "Publisher"), Type: "text"},
					{Name: tr("Genre", "Genre"), Type: "text"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
			{
				Name:        tr("Books", "Bücher"),
				Description: tr("A warm mixed library of favorite fiction and series titles.", "Eine warme, gemischte Bibliothek mit Lieblingsromanen und Reihen."),
				Color:       "#7c3aed",
				Properties: []propertySeed{
					{Name: tr("Author", "Autor"), Type: "text", ShowInList: true},
					{Name: tr("Language", "Sprache"), Type: "text", ShowInList: true},
					{Name: tr("Format", "Format"), Type: "text", ShowInList: true},
					{Name: tr("Series", "Reihe"), Type: "text"},
					{Name: tr("Condition", "Zustand"), Type: "condition", ShowInList: true},
				},
			},
		},
		Locations: []locationSeed{
			{Name: tr("Collection Room", "Sammlungszimmer"), Description: tr("Warm collector room with display shelving for cards, retro games, and books.", "Warmes Sammlungszimmer mit Regalen für Karten, Retrospiele und Bücher."), Color: "#a855f7", Capacity: intPtr(90)},
			{Name: tr("Card Shelf", "Kartenregal"), Parent: tr("Collection Room", "Sammlungszimmer"), Description: tr("Shelving for binders, sealed products, and card storage.", "Regal für Binder, versiegelte Produkte und Kartenaufbewahrung."), Color: "#c084fc", Capacity: intPtr(16)},
			{Name: tr("Retro Games Shelf", "Retrospieleregal"), Parent: tr("Collection Room", "Sammlungszimmer"), Description: tr("Display shelf for cartridge-based classics and boxed pieces.", "Regal für Modul-Klassiker und ausgewählte Boxen."), Color: "#d8b4fe", Capacity: intPtr(20)},
			{Name: tr("Bookcase", "Bücherregal"), Parent: tr("Collection Room", "Sammlungszimmer"), Description: tr("Bookcase with favorite fiction and series titles.", "Bücherregal mit Lieblingsromanen und Reihen."), Color: "#ddd6fe", Capacity: intPtr(30)},
			{Name: tr("Display Cabinet", "Vitrine"), Parent: tr("Collection Room", "Sammlungszimmer"), Description: tr("Protected display area for standout collector pieces.", "Geschützter Platz für besondere Sammlungsstücke."), Color: "#f0abfc", Capacity: intPtr(12)},
		},
		Manufacturers: []vendorSeed{
			{Name: "Nintendo", Website: "https://www.nintendo.com"},
			{Name: "The Pokemon Company", Website: "https://www.pokemon.com"},
		},
		Suppliers: []vendorSeed{
			{Name: "Local Electronics Store"},
			{Name: "Local Bookstore"},
			{Name: "Retro Fair"},
			{Name: "Card Market"},
		},
		Vendors: []vendorSeed{
			{Name: "Cardmarket", Website: "https://www.cardmarket.com"},
			{Name: "Retro Trade"},
		},
		Items:     curatedCollectionItems(tr),
		Checkouts: []checkoutSeed{},
		Requests:  []requestSeed{},
	}

	return data
}

func curatedCollectionItems(tr func(string, string) string) []itemSeed {
	return []itemSeed{
		{
			Name:          tr("Pokemon 151 Elite Trainer Box", "Pokemon 151 Elite Trainer Box"),
			Description:   tr("Sealed elite trainer box kept as a display-friendly modern collector item.", "Versiegelte Elite Trainer Box als modernes, gut sichtbares Sammlerstück."),
			Category:      tr("Trading Card Games", "Sammelkarten"),
			Location:      tr("Display Cabinet", "Vitrine"),
			Quantity:      1,
			Manufacturer:  "The Pokemon Company",
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 59.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-11-04",
			Properties: map[string]interface{}{
				tr("Set", "Set"):           "Scarlet & Violet 151",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Rarity", "Seltenheit"): tr("Collector box", "Sammlerbox"),
				tr("Sealed", "Versiegelt"): true,
				tr("Graded", "Gegradet"):   false,
				tr("Condition", "Zustand"): "like_new",
			},
		},
		{
			Name:          tr("Pokemon Crown Zenith Elite Trainer Box", "Pokemon Crown Zenith Elite Trainer Box"),
			Description:   tr("Sealed premium expansion box stored with other modern collection highlights.", "Versiegelte Premium-Box als moderner Sammlungshöhepunkt."),
			Category:      tr("Trading Card Games", "Sammelkarten"),
			Location:      tr("Card Shelf", "Kartenregal"),
			Quantity:      1,
			Manufacturer:  "The Pokemon Company",
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 54.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-10-19",
			Properties: map[string]interface{}{
				tr("Set", "Set"):           "Crown Zenith",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Rarity", "Seltenheit"): tr("Collector box", "Sammlerbox"),
				tr("Sealed", "Versiegelt"): true,
				tr("Graded", "Gegradet"):   false,
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          tr("Binder: Favorite Pokemon Cards", "Binder: Lieblings-Pokemonkarten"),
			Description:   tr("Curated binder with favorite cards, sorted for display and quick browsing.", "Kuratierter Binder mit Lieblingskarten zum Durchsehen und Präsentieren."),
			Category:      tr("Trading Card Games", "Sammelkarten"),
			Location:      tr("Card Shelf", "Kartenregal"),
			Quantity:      1,
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 89.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-09-11",
			Properties: map[string]interface{}{
				tr("Set", "Set"):           tr("Mixed", "Gemischt"),
				tr("Language", "Sprache"):  tr("Mixed", "Gemischt"),
				tr("Rarity", "Seltenheit"): tr("Favorites binder", "Lieblings-Binder"),
				tr("Sealed", "Versiegelt"): false,
				tr("Graded", "Gegradet"):   false,
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          tr("Graded Charizard Display Card", "Gegradete Charizard Display-Karte"),
			Description:   tr("High-visibility display card used as the centerpiece of the card collection.", "Gut sichtbare Display-Karte als Mittelpunkt der Karten-Sammlung."),
			Category:      tr("Trading Card Games", "Sammelkarten"),
			Location:      tr("Display Cabinet", "Vitrine"),
			Quantity:      1,
			Manufacturer:  "The Pokemon Company",
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 249.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-08-01",
			Properties: map[string]interface{}{
				tr("Set", "Set"):           tr("Modern promo", "Modernes Promo"),
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Rarity", "Seltenheit"): tr("Ultra rare", "Ultra Rare"),
				tr("Sealed", "Versiegelt"): false,
				tr("Graded", "Gegradet"):   true,
				tr("Condition", "Zustand"): "like_new",
			},
		},
		{
			Name:          tr("Toploader Storage Box", "Toploader-Aufbewahrungsbox"),
			Description:   tr("Protective storage box for sorted singles, toploaders, and trade-ready cards.", "Schutzbox für sortierte Einzelkarten, Toploader und tauschbereite Karten."),
			Category:      tr("Trading Card Storage", "Kartenaufbewahrung"),
			Location:      tr("Card Shelf", "Kartenregal"),
			Quantity:      1,
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 24.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-09-03",
			Properties: map[string]interface{}{
				tr("Material", "Material"):  tr("Plastic", "Kunststoff"),
				tr("Capacity", "Kapazität"): tr("100 cards", "100 Karten"),
				tr("Condition", "Zustand"):  "very_good",
			},
		},
		{
			Name:          tr("Pokemon Booster Bundle", "Pokemon Booster Bundle"),
			Description:   tr("Compact sealed bundle used as a smaller collector piece beside the larger boxes.", "Kompaktes versiegeltes Bundle als kleineres Sammlerstück neben den größeren Boxen."),
			Category:      tr("Trading Card Games", "Sammelkarten"),
			Location:      tr("Display Cabinet", "Vitrine"),
			Quantity:      1,
			Manufacturer:  "The Pokemon Company",
			Supplier:      "Card Market",
			Vendor:        "Cardmarket",
			PurchasePrice: 34.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-11-12",
			Properties: map[string]interface{}{
				tr("Set", "Set"):           "Scarlet & Violet",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Rarity", "Seltenheit"): tr("Booster bundle", "Booster-Bundle"),
				tr("Sealed", "Versiegelt"): true,
				tr("Graded", "Gegradet"):   false,
				tr("Condition", "Zustand"): "like_new",
			},
		},
		{
			Name:          "Donkey Kong Country",
			Description:   tr("Classic platformer kept as one of the most recognizable shelf pieces in the retro collection.", "Klassischer Plattformer als eines der markantesten Stücke im Retroregal."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 34.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-06-01",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1994,
				tr("Complete in box", "Komplett in Box"):     false,
				tr("Manual included", "Anleitung enthalten"): false,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Platform", "Plattformer"),
				tr("Condition", "Zustand"):                   "very_good",
			},
		},
		{
			Name:          "Super Mario World",
			Description:   tr("Foundational SNES classic kept as a clean cartridge-and-box shelf favorite.", "Grundlegender SNES-Klassiker als sauberes Lieblingsstück mit Modul und Box."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 39.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-05-27",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1991,
				tr("Complete in box", "Komplett in Box"):     true,
				tr("Manual included", "Anleitung enthalten"): true,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Platform", "Plattformer"),
				tr("Condition", "Zustand"):                   "very_good",
			},
		},
		{
			Name:          "F-Zero",
			Description:   tr("Fast futuristic racer used to broaden the shelf beyond platform games.", "Schneller futuristischer Racer, der das Regal über Jump'n'Runs hinaus erweitert."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 29.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-06-10",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1990,
				tr("Complete in box", "Komplett in Box"):     false,
				tr("Manual included", "Anleitung enthalten"): false,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Racing", "Rennspiel"),
				tr("Condition", "Zustand"):                   "good",
			},
		},
		{
			Name:          "The Legend of Zelda: A Link to the Past",
			Description:   tr("Adventure shelf highlight kept as one of the warmer boxed centerpiece titles.", "Abenteuer-Highlight als eines der stärkeren Boxstücke im Regal."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Display Cabinet", "Vitrine"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 74.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-04-29",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1992,
				tr("Complete in box", "Komplett in Box"):     true,
				tr("Manual included", "Anleitung enthalten"): true,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Adventure", "Abenteuer"),
				tr("Condition", "Zustand"):                   "good",
			},
		},
		{
			Name:          "Super Metroid",
			Description:   tr("Moody science-fiction classic that adds atmosphere and range to the shelf.", "Stimmungsvoller Science-Fiction-Klassiker, der dem Regal mehr Spannweite gibt."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 69.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-07-15",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1994,
				tr("Complete in box", "Komplett in Box"):     false,
				tr("Manual included", "Anleitung enthalten"): false,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Action adventure", "Action-Adventure"),
				tr("Condition", "Zustand"):                   "good",
			},
		},
		{
			Name:          "Mario Kart",
			Description:   tr("Multiplayer favorite that makes the retro shelf feel more social and approachable.", "Mehrspieler-Klassiker, der das Retroregal zugänglicher und geselliger macht."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 42.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-08-04",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1992,
				tr("Complete in box", "Komplett in Box"):     false,
				tr("Manual included", "Anleitung enthalten"): false,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Racing", "Rennspiel"),
				tr("Condition", "Zustand"):                   "very_good",
			},
		},
		{
			Name:          "Yoshi's Island",
			Description:   tr("Bright later-era SNES favorite that softens the tone of the retro lineup.", "Farbenfroher später SNES-Liebling, der die Retro-Reihe etwas weicher macht."),
			Category:      tr("Retro Games", "Retrospiele"),
			Location:      tr("Retro Games Shelf", "Retrospieleregal"),
			Quantity:      1,
			Manufacturer:  "Nintendo",
			Supplier:      "Retro Fair",
			Vendor:        "Retro Trade",
			PurchasePrice: 54.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-09-09",
			Properties: map[string]interface{}{
				tr("Platform", "Plattform"):                  "SNES",
				tr("Region", "Region"):                       "PAL",
				tr("Release year", "Erscheinungsjahr"):       1995,
				tr("Complete in box", "Komplett in Box"):     false,
				tr("Manual included", "Anleitung enthalten"): false,
				tr("Publisher", "Publisher"):                 "Nintendo",
				tr("Genre", "Genre"):                         tr("Platform", "Plattformer"),
				tr("Condition", "Zustand"):                   "good",
			},
		},
		{
			Name:          tr("The Lord of the Rings Trilogy", "Der Herr der Ringe Trilogie"),
			Description:   tr("Beloved fantasy trilogy kept together as a single display-worthy reading set.", "Geliebte Fantasy-Trilogie als zusammengehöriges, präsentables Leseset."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 39.99,
			Currency:      "EUR",
			PurchaseDate:  "2025-02-03",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "J.R.R. Tolkien",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback set", "Taschenbuch-Set"),
				tr("Series", "Reihe"):      tr("The Lord of the Rings", "Der Herr der Ringe"),
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          "Wool",
			Description:   tr("First Silo novel, kept with other recent science-fiction favorites.", "Erster Silo-Roman, gemeinsam mit neueren Science-Fiction-Favoriten im Regal."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 14.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-06-06",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Hugh Howey",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "Silo",
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          "Shift",
			Description:   tr("Second Silo novel kept next to Wool as part of the same reading arc.", "Zweiter Silo-Roman, direkt neben Wool als Teil derselben Reihe."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 14.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-06-12",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Hugh Howey",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "Silo",
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          "Northern Lights",
			Description:   tr("Opening volume of His Dark Materials, adding a classic younger-reader fantasy note.", "Auftakt von His Dark Materials und klassischer, jüngerer Fantasy-Ton im Regal."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 12.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-05-04",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Philip Pullman",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "His Dark Materials",
				tr("Condition", "Zustand"): "good",
			},
		},
		{
			Name:          "The Subtle Knife",
			Description:   tr("Second His Dark Materials volume kept beside the opening novel.", "Zweiter Band von His Dark Materials, direkt neben dem Auftaktband."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 12.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-05-04",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Philip Pullman",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "His Dark Materials",
				tr("Condition", "Zustand"): "good",
			},
		},
		{
			Name:          "The Amber Spyglass",
			Description:   tr("Final volume completing the His Dark Materials trio on the shelf.", "Abschlussband, der die His-Dark-Materials-Reihe im Regal vervollständigt."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 12.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-05-04",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Philip Pullman",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "His Dark Materials",
				tr("Condition", "Zustand"): "good",
			},
		},
		{
			Name:          "The Hitchhiker's Guide to the Galaxy",
			Description:   tr("Humorous science-fiction staple that adds a lighter note to the shelf.", "Humorvoller Science-Fiction-Klassiker, der dem Regal einen leichteren Ton gibt."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 11.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-03-18",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "Douglas Adams",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      tr("The Hitchhiker's Guide to the Galaxy", "Per Anhalter durch die Galaxis"),
				tr("Condition", "Zustand"): "very_good",
			},
		},
		{
			Name:          "Harry Potter and the Philosopher's Stone",
			Description:   tr("Familiar first-volume fantasy title that makes the shelf feel immediately lived in.", "Vertrauter erster Fantasy-Band, der das Regal sofort bewohnt wirken lässt."),
			Category:      tr("Books", "Bücher"),
			Location:      tr("Bookcase", "Bücherregal"),
			Quantity:      1,
			Supplier:      "Local Bookstore",
			PurchasePrice: 10.00,
			Currency:      "EUR",
			PurchaseDate:  "2025-02-25",
			Properties: map[string]interface{}{
				tr("Author", "Autor"):      "J.K. Rowling",
				tr("Language", "Sprache"):  tr("English", "Englisch"),
				tr("Format", "Format"):     tr("Paperback", "Taschenbuch"),
				tr("Series", "Reihe"):      "Harry Potter",
				tr("Condition", "Zustand"): "good",
			},
		},
	}
}

func normalizeLang(lang string) string {
	switch strings.ToLower(strings.TrimSpace(lang)) {
	case "de":
		return "de"
	default:
		return "en"
	}
}

func normalizePreset(preset string) string {
	switch strings.ToLower(strings.TrimSpace(preset)) {
	case "curated":
		return "curated"
	default:
		return "demo"
	}
}

func presetSeededKey(preset string) string {
	if normalizePreset(preset) == "curated" {
		return "seededCuratedData"
	}
	return "seededData"
}

func datasetForPreset(preset, adminEmail, lang string) map[string]realmDataset {
	switch normalizePreset(preset) {
	case "curated":
		return map[string]realmDataset{
			"archive":    curatedArchive(lang),
			"collection": curatedCollection(adminEmail, lang),
		}
	default:
		return map[string]realmDataset{
			"archive":    archiveDemo(adminEmail, lang),
			"collection": collectionDemo(adminEmail, lang),
		}
	}
}

func localeText(lang, key string) string {
	texts := map[string]map[string]string{
		"en": {
			"createdAdmin":      "Created admin: %s <%s>\n",
			"seededData":        "Seeded realistic demo data for archive and collection.",
			"seededCuratedData": "Seeded curated showcase data for archive and collection.",
			"loginLinks":        "Demo login links:",
			"resetTip":          "Tip: use --reset when you want to replace an existing demo dataset.",
		},
		"de": {
			"createdAdmin":      "Admin angelegt: %s <%s>\n",
			"seededData":        "Realistische Demo-Daten für Archiv und Sammlung wurden angelegt.",
			"seededCuratedData": "Kuratierte Präsentationsdaten für Archiv und Sammlung wurden angelegt.",
			"loginLinks":        "Demo-Login-Links:",
			"resetTip":          "Tipp: Nutze --reset, wenn du einen bestehenden Demo-Datensatz ersetzen möchtest.",
		},
	}
	if value, ok := texts[lang][key]; ok {
		return value
	}
	return texts["en"][key]
}

func localizeArchiveGerman(data realmDataset) realmDataset {
	stringMap := map[string]string{
		"Electronics": "Elektronik",
		"Boards, single-board computers, and adapters used for prototyping and maintenance work.": "Boards, Mikrocontroller und kleine Hardware für Werkstatt und Prototyping.",
		"Voltage":   "Spannung",
		"Connector": "Anschluss",
		"Power":     "Leistung",
		"Condition": "Zustand",
		"Tools":     "Werkzeug",
		"Hand tools and measuring gear that move between the bench, storage, and onsite jobs.": "Handwerkzeuge und Messgeräte für die tägliche Arbeit.",
		"Material":    "Material",
		"Weight":      "Gewicht",
		"Powered":     "Elektrisch",
		"3D Printing": "3D-Druck",
		"Filament and print consumables stocked for repairs, fixtures, and quick prototypes.": "Filament, Resin und Zubehör für Druckjobs im Alltag.",
		"Diameter":        "Durchmesser",
		"Color":           "Farbe",
		"Priority":        "Priorität",
		"Office Supplies": "Büro",
		"Shipping labels and administrative supplies used to keep the workspace running.": "Label, Papier und kleine Organisationshelfer für den Versand- und Verwaltungsalltag.",
		"Workshop": "Werkstatt",
		"Main repair and prototyping area with the daily-use benches.": "Hauptbereich für Reparatur, Basteln und Druck.",
		"Electronics Bench": "Werkbank links",
		"Bench with the power supply, soldering station, and test gear.": "Elektronikplatz mit Oszilloskop und Netzteil.",
		"Assembly Bench": "Werkbank rechts",
		"Mechanical assembly space for fixtures, housings, and general repairs.": "Mechanik und Montage.",
		"Supply Storage": "Materiallager",
		"Back stock shelves for adapters, consumables, and print material.": "Regale für Verbrauchsmaterial und Nachschub.",
		"Electronics Shelf": "Regal A",
		"Spare boards, cables, and adapters kept in labeled bins.": "Elektronik und Adapter.",
		"Print Shelf": "Regal B",
		"Filament and printer consumables organized by material and color.": "Filament und Verbrauchsmaterial.",
		"Shipping Desk": "Büro",
		"Label rolls, packing supplies, and outgoing paperwork.":                                "Versand, Etiketten und Verwaltung.",
		"General-purpose controller board used for demos, fixture tests, and quick prototypes.": "Standardboard für schnelle Prototypen und kleine Steuerungsaufgaben.",
		"Official documentation": "Offizielle Dokumentation",
		"Raspberry Pi 5 8GB":     "Raspberry Pi 5 8GB",
		"Small server and kiosk board kept in reserve for dashboards, camera stations, and signage tests.": "Schneller Single Board Computer für Dashboard, Kamera und kleine Server-Aufgaben.",
		"Fluke 117 Multimeter": "Fluke 117 Multimeter",
		"Primary True-RMS multimeter used for diagnostics, field service, and incoming checks.": "True-RMS Multimeter für Service und Fehlersuche.",
		"Plastic":            "Kunststoff",
		"Wera Kraftform Set": "Wera Kraftform Set",
		"Bench screwdriver set for small electronics, fixtures, and enclosure work.": "Schraubendreher-Set für Elektronik und Werkbank.",
		"Chrome Vanadium":      "Chrom-Vanadium",
		"PETG Transparent 1kg": "PETG Transparent 1kg",
		"Clear PETG spool used for durable brackets, covers, and workshop fixtures.": "Universelles PETG für robuste Gehäuse und Halterungen.",
		"PLA Black 1kg": "PLA Schwarz 1kg",
		"Fast everyday filament for test prints, labels, and quick fit checks.": "Schnelles Standardfilament für Prototypen und Labels.",
		"Black":               "Schwarz",
		"USB-C Cable 2m 100W": "USB-C Kabel 2m 100W",
		"High-power USB-C cables kept in stock for boards, displays, and power supply tests.": "Schnell zum Testen von Netzteilen, Boards und Displays griffbereit.",
		"Thermal Labels 100x150": "Thermo Labels 100x150",
		"Thermal shipping and location labels for printers, inventory tags, and packing runs.": "Versand- und Standortlabel für Drucker und Lagerworkflow.",
		"White": "Weiß",
		"Electrical testing kit for an onsite installation visit":       "Messung für mobile Installation",
		"Returned after a youth workshop kit was packed down":           "Workshop erfolgreich abgeschlossen",
		"Needed for a customer site visit and incoming power checks":    "Vor-Ort-Termin bei Kunde",
		"Workshop kit for a local coding session":                       "Workshop-Set für Nachwuchsgruppe",
		"Requested for a short event setup and teardown job":            "Kurze Montagehilfe für Event-Aufbau",
		"Reserved for a permanent kiosk installation and not available": "Für Produktivinstallation aktuell reserviert",
	}
	return translateRealmDataset(data, stringMap)
}

func localizeCollectionGerman(data realmDataset) realmDataset {
	stringMap := map[string]string{
		"Retro Games": "Retro Games",
		"Boxed games, cartridges, and collector editions with condition-focused catalog data.": "Spiele, Boxen und Module mit Fokus auf gut prüfbare Sammlungsdaten.",
		"Platform":   "Plattform",
		"Region":     "Region",
		"Complete":   "Komplett",
		"Age Rating": "Altersfreigabe",
		"Condition":  "Zustand",
		"Consoles":   "Konsolen",
		"Home consoles and handhelds tracked by condition and working status.": "Konsolen und Handhelds mit Zustand und Funktionsstatus.",
		"Manufacturer": "Hersteller",
		"Release Year": "Erscheinungsjahr",
		"Working":      "Funktionsfähig",
		"Vinyl":        "Vinyl",
		"Records catalogued by format, genre, listening rating, and overall condition.": "Platten mit Format, Zustand und persönlicher Bewertung.",
		"Rating":      "Bewertung",
		"Photography": "Kamera",
		"Camera bodies and lenses with mount, weight, and condition details.": "Bodies und Objektive mit Mount, Zustand und Gewicht.",
		"Weight":                      "Gewicht",
		"Living Room Display Cabinet": "Wohnzimmer Vitrine",
		"Visible favorite pieces on permanent display.": "Die sichtbaren Lieblingsstücke.",
		"Top Shelf": "Vitrine oben",
		"Display space for standout consoles and cleaned highlights.": "Handhelds und Highlights.",
		"Middle Shelf": "Vitrine mitte",
		"Boxed games and compact collector pieces.": "Konsolen und Spiele.",
		"Media Shelf": "Medienregal",
		"Open shelving for records, larger game boxes, and media hardware.": "Platten und größere Boxen.",
		"Vinyl Section": "Vinyl-Bereich",
		"Alphabetized record section with listening copies and favorites.": "Sortierter Bereich für Platten und Lieblingsstücke.",
		"Studio Shelf": "Studio Shelf",
		"Camera and audio shelf for active projects and ready-to-grab gear.": "Kamera- und Audioecke für laufende Projekte.",
		"Safe": "Safe",
		"Protected storage for valuables and fragile collector pieces.": "Wertsachen und empfindliche Sammlungsstücke.",
		"Super Mario World": "Super Mario World",
		"SNES classic with box, insert, and manual stored with the display games.": "SNES Klassiker komplett mit Box und Anleitung.",
		"The Legend of Zelda: Ocarina of Time":                                     "The Legend of Zelda: Ocarina of Time",
		"N64 collector copy with a clean cartridge and a lightly worn outer box.":  "N64, guter Modulzustand, Box mit leichter Patina.",
		"PlayStation 2 Slim": "PlayStation 2 Slim",
		"Clean slim console with one controller and the original AV cable set.": "Gut erhaltene Slim mit Controller und AV-Kabel.",
		"Nintendo 64 Console": "Nintendo 64 Konsole",
		"PAL console with Expansion Pak installed and a freshly cleaned shell.": "PAL-Konsole mit Expansion Pak und gereinigtem Gehäuse.",
		"Dark Side of the Moon": "Dark Side of the Moon",
		"180g UK reissue stored with the high-rotation listening records.":                    "UK Reissue auf 180g Vinyl, sehr sauber erhalten.",
		"Blade Runner 2049 Soundtrack":                                                        "Blade Runner 2049 Soundtrack",
		"Double LP used for listening sessions and quick speaker checks in the media corner.": "Doppelte LP für Klangtests und Lieblingsabende.",
		"Canon AE-1": "Canon AE-1",
		"Analog camera body with a working light meter, stored with the active project gear.": "Analoge Kamera mit schöner Patina und funktionierendem Belichtungsmesser.",
		"Canon FD 50mm f/1.8": "Canon FD 50mm f/1.8",
		"Compact standard lens stored separately in the safe when it is not mounted.": "Leichtes Standardobjektiv für die AE-1.",
		"Electronic": "Elektronik",
		"Checked out for a weekend magazine shoot":             "Wochenend-Shooting für Magazinprojekt",
		"Reserved for an outdoor production and lens test day": "Kamera für Außenproduktion reserviert",
		"Requested for a retro night with a capture setup":     "Retro-Abend mit Capture-Setup",
	}
	return translateRealmDataset(data, stringMap)
}

func translateRealmDataset(data realmDataset, tr map[string]string) realmDataset {
	translate := func(s string) string {
		if v, ok := tr[s]; ok {
			return v
		}
		return s
	}

	for i := range data.Categories {
		data.Categories[i].Name = translate(data.Categories[i].Name)
		data.Categories[i].Description = translate(data.Categories[i].Description)
		for j := range data.Categories[i].Properties {
			data.Categories[i].Properties[j].Name = translate(data.Categories[i].Properties[j].Name)
		}
	}
	for i := range data.Locations {
		data.Locations[i].Name = translate(data.Locations[i].Name)
		data.Locations[i].Description = translate(data.Locations[i].Description)
		data.Locations[i].Parent = translate(data.Locations[i].Parent)
	}
	for i := range data.Items {
		item := &data.Items[i]
		item.Name = translate(item.Name)
		item.Description = translate(item.Description)
		item.Category = translate(item.Category)
		item.Location = translate(item.Location)
		translatedProps := map[string]interface{}{}
		for key, value := range item.Properties {
			newKey := translate(key)
			if str, ok := value.(string); ok {
				translatedProps[newKey] = translate(str)
			} else {
				translatedProps[newKey] = value
			}
		}
		item.Properties = translatedProps
		for j := range item.Attachments {
			item.Attachments[j].Note = translate(item.Attachments[j].Note)
		}
	}
	for i := range data.Checkouts {
		data.Checkouts[i].ItemName = translate(data.Checkouts[i].ItemName)
		data.Checkouts[i].Notes = translate(data.Checkouts[i].Notes)
	}
	for i := range data.Requests {
		data.Requests[i].ItemName = translate(data.Requests[i].ItemName)
		data.Requests[i].Notes = translate(data.Requests[i].Notes)
	}
	return data
}
