package items

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/itemplus/backend/internal/database"
	"github.com/jmoiron/sqlx"
)

// Orphaned items are items whose category or location is not what it should
// be: the category is missing altogether, or the item points to a category
// or location that was deleted. Older versions allowed that, and on MySQL
// nothing stopped it. Such items are never changed automatically. An
// administrator decides: give the deleted category or location back, or move
// the items to one that exists.

const (
	OrphanCategoryMissing = "category_missing" // the item has no category
	OrphanCategoryDeleted = "category_deleted" // the item's category no longer exists
	OrphanLocationDeleted = "location_deleted" // the item's location no longer exists
)

// orphanItemPreview limits how many item names a group lists; ItemCount
// always has the real number.
const orphanItemPreview = 25

type OrphanItem struct {
	ID   int    `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
}

type OrphanGroup struct {
	Realm     string       `json:"realm"`
	Kind      string       `json:"kind"`
	RefID     *int         `json:"ref_id"` // the deleted category or location; nil when the category is missing
	ItemCount int          `json:"item_count"`
	Items     []OrphanItem `json:"items"`
	// Property definitions of the deleted category that are still stored. With
	// them, restoring the category brings every value back.
	Properties int `json:"properties"`
	// The catalog profile the deleted category was created from, if any. It
	// helps to recognise which category this was.
	ProfileKey string `json:"profile_key,omitempty"`
}

var ErrOrphanTargetNotFound = errors.New("the target does not exist")
var ErrOrphanNotDeleted = errors.New("this category or location exists")

// ListOrphanedItems returns the orphaned items of both realms, grouped by
// what is wrong with them.
func ListOrphanedItems() ([]OrphanGroup, error) {
	groups := []OrphanGroup{}
	for _, realm := range []string{"archive", "collection"} {
		var missing []OrphanItem
		if err := database.DB.Select(&missing, fmt.Sprintf(
			"SELECT id, name FROM %s_items WHERE category_id IS NULL ORDER BY name, id", realm)); err != nil {
			return nil, err
		}
		if len(missing) > 0 {
			groups = append(groups, newOrphanGroup(realm, OrphanCategoryMissing, nil, missing))
		}

		for _, relation := range []struct{ kind, column, table string }{
			{OrphanCategoryDeleted, "category_id", realm + "_categories"},
			{OrphanLocationDeleted, "location_id", realm + "_locations"},
		} {
			var rows []struct {
				OrphanItem
				RefID int `db:"ref_id"`
			}
			if err := database.DB.Select(&rows, fmt.Sprintf(
				`SELECT id, name, %[1]s AS ref_id FROM %[2]s_items
				WHERE %[1]s IS NOT NULL AND %[1]s NOT IN (SELECT id FROM %[3]s)
				ORDER BY %[1]s, name, id`, relation.column, realm, relation.table)); err != nil {
				return nil, err
			}
			byRef := map[int][]OrphanItem{}
			var order []int
			for _, row := range rows {
				if _, seen := byRef[row.RefID]; !seen {
					order = append(order, row.RefID)
				}
				byRef[row.RefID] = append(byRef[row.RefID], row.OrphanItem)
			}
			for _, refID := range order {
				id := refID
				group := newOrphanGroup(realm, relation.kind, &id, byRef[refID])
				if relation.kind == OrphanCategoryDeleted {
					properties, err := loadCategoryProperties(database.DB, realm, refID)
					if err != nil {
						return nil, err
					}
					group.Properties = len(properties)
					for _, property := range properties {
						if property.profileKey != "" {
							group.ProfileKey = property.profileKey
							break
						}
					}
				}
				groups = append(groups, group)
			}
		}
	}
	return groups, nil
}

func newOrphanGroup(realm, kind string, refID *int, items []OrphanItem) OrphanGroup {
	group := OrphanGroup{Realm: realm, Kind: kind, RefID: refID, ItemCount: len(items), Items: items}
	if len(items) > orphanItemPreview {
		group.Items = items[:orphanItemPreview]
	}
	return group
}

type categoryProperty struct {
	ID           int     `db:"id"`
	Name         string  `db:"name"`
	PropertyType string  `db:"property_type"`
	Options      *string `db:"options"`
	profileKey   string
	propertyKey  string
}

// matchKey says which property of another category is "the same" property:
// the same catalog field if both come from the game catalog, otherwise the
// same name and type.
func (p categoryProperty) matchKeys() []string {
	keys := []string{}
	if p.propertyKey != "" {
		keys = append(keys, "catalog:"+p.propertyKey)
	}
	return append(keys, "name:"+strings.ToLower(strings.TrimSpace(p.Name))+"|"+p.PropertyType)
}

type queryer interface {
	Select(dest interface{}, query string, args ...interface{}) error
}

func loadCategoryProperties(q queryer, realm string, categoryID int) ([]categoryProperty, error) {
	var properties []categoryProperty
	if err := q.Select(&properties, fmt.Sprintf(
		"SELECT id, name, property_type, options FROM %s_properties WHERE category_id = ? ORDER BY id", realm), categoryID); err != nil {
		return nil, err
	}
	for i := range properties {
		if properties[i].Options == nil {
			continue
		}
		var options struct {
			GameCatalog struct {
				ProfileKey  string `json:"profile_key"`
				PropertyKey string `json:"property_key"`
			} `json:"game_catalog"`
		}
		if json.Unmarshal([]byte(*properties[i].Options), &options) == nil {
			properties[i].profileKey = options.GameCatalog.ProfileKey
			properties[i].propertyKey = options.GameCatalog.PropertyKey
		}
	}
	return properties, nil
}

func orphanTable(realm, kind string) (table, column string, err error) {
	if !validRealm(realm) {
		return "", "", fmt.Errorf("invalid realm %q", realm)
	}
	switch kind {
	case OrphanCategoryDeleted, OrphanCategoryMissing:
		return realm + "_categories", "category_id", nil
	case OrphanLocationDeleted:
		return realm + "_locations", "location_id", nil
	}
	return "", "", fmt.Errorf("invalid kind %q", kind)
}

// RestoreOrphanTarget gives a deleted category or location back under its old
// id, so the items that still point to it (and, for a category, its property
// definitions and their values) are whole again. It refuses when nothing
// points to that id or when the id is in use.
func RestoreOrphanTarget(realm, kind string, id int, name string) error {
	table, column, err := orphanTable(realm, kind)
	if err != nil || kind == OrphanCategoryMissing {
		return fmt.Errorf("nothing to restore for kind %q", kind)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("a name is required")
	}
	return database.WithoutCascades(func(tx *sqlx.Tx) error {
		var exists, pointing int
		if err := tx.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", table), id); err != nil {
			return err
		}
		if exists > 0 {
			return ErrOrphanNotDeleted
		}
		if err := tx.Get(&pointing, fmt.Sprintf("SELECT COUNT(*) FROM %s_items WHERE %s = ?", realm, column), id); err != nil {
			return err
		}
		if pointing == 0 {
			return ErrOrphanTargetNotFound
		}
		now := database.TimestampNow()
		_, err := tx.Exec(fmt.Sprintf("INSERT INTO %s (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", table), id, name, now, now)
		return err
	})
}

// OrphanAssignment says what moving orphaned items did, or (for a dry run)
// would do.
type OrphanAssignment struct {
	Items int `json:"items"`
	// Property values that found the same property in the new category.
	ValuesMoved int `json:"values_moved"`
	// Property values without a counterpart there. They are deleted together
	// with the old category's property definitions.
	ValuesDropped     int      `json:"values_dropped"`
	DroppedProperties []string `json:"dropped_properties"`
}

var errDryRun = errors.New("dry run")

// AssignOrphans moves the orphaned items of one group to an existing category
// or location. For a deleted category the items' property values go along
// where the new category has the same property; the rest cannot be shown
// anywhere any more and is removed with the old definitions. With dryRun
// nothing is changed and the result says what would happen.
func AssignOrphans(realm, kind string, refID *int, targetID int, dryRun bool) (OrphanAssignment, error) {
	result := OrphanAssignment{DroppedProperties: []string{}}
	table, column, err := orphanTable(realm, kind)
	if err != nil {
		return result, err
	}
	if (kind == OrphanCategoryMissing) != (refID == nil) {
		return result, fmt.Errorf("kind %q and ref_id do not fit together", kind)
	}

	err = database.WithoutCascades(func(tx *sqlx.Tx) error {
		var exists int
		if err := tx.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", table), targetID); err != nil {
			return err
		}
		if exists == 0 {
			return ErrOrphanTargetNotFound
		}

		where, args := column+" IS NULL", []interface{}{}
		if refID != nil {
			if err := tx.Get(&exists, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", table), *refID); err != nil {
				return err
			}
			if exists > 0 {
				return ErrOrphanNotDeleted
			}
			where, args = column+" = ?", []interface{}{*refID}
		}
		if err := tx.Get(&result.Items, fmt.Sprintf("SELECT COUNT(*) FROM %s_items WHERE %s", realm, where), args...); err != nil {
			return err
		}

		if kind == OrphanCategoryDeleted {
			if err := moveCategoryValues(tx, realm, *refID, targetID, &result); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(fmt.Sprintf("UPDATE %s_items SET %s = ?, updated_at = ? WHERE %s", realm, column, where),
			append([]interface{}{targetID, database.TimestampNow()}, args...)...); err != nil {
			return err
		}
		if dryRun {
			return errDryRun
		}
		return nil
	})
	if errors.Is(err, errDryRun) {
		err = nil
	}
	return result, err
}

// moveCategoryValues re-homes the property values of a deleted category's
// items and removes the old definitions.
func moveCategoryValues(tx *sqlx.Tx, realm string, fromCategory, toCategory int, result *OrphanAssignment) error {
	oldProperties, err := loadCategoryProperties(tx, realm, fromCategory)
	if err != nil {
		return err
	}
	newProperties, err := loadCategoryProperties(tx, realm, toCategory)
	if err != nil {
		return err
	}
	counterpart := map[string]int{}
	for _, property := range newProperties {
		for _, key := range property.matchKeys() {
			if _, taken := counterpart[key]; !taken {
				counterpart[key] = property.ID
			}
		}
	}

	values := realm + "_item_properties"
	for _, property := range oldProperties {
		var stored int
		if err := tx.Get(&stored, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE property_id = ?", values), property.ID); err != nil {
			return err
		}
		target := 0
		for _, key := range property.matchKeys() {
			if id, ok := counterpart[key]; ok {
				target = id
				break
			}
		}
		if target != 0 {
			if _, err := tx.Exec(fmt.Sprintf("UPDATE %s SET property_id = ? WHERE property_id = ?", values), target, property.ID); err != nil {
				return err
			}
			result.ValuesMoved += stored
			continue
		}
		if stored > 0 {
			result.ValuesDropped += stored
			result.DroppedProperties = append(result.DroppedProperties, property.Name)
		}
		if _, err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE property_id = ?", values), property.ID); err != nil {
			return err
		}
	}
	sort.Strings(result.DroppedProperties)
	_, err = tx.Exec(fmt.Sprintf("DELETE FROM %s_properties WHERE category_id = ?", realm), fromCategory)
	return err
}
