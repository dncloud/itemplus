package database

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

var sqlIdentifierPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func quoteSQLIdentifier(name string) (string, error) {
	if !sqlIdentifierPattern.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier")
	}
	return "`" + name + "`", nil
}

func sortedKeys(data map[string]interface{}) []string {
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func BuildUpdate(data map[string]interface{}) (string, []interface{}, error) {
	sets := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	for _, key := range sortedKeys(data) {
		quoted, err := quoteSQLIdentifier(key)
		if err != nil {
			return "", nil, err
		}
		sets = append(sets, quoted+" = ?")
		vals = append(vals, data[key])
	}
	return strings.Join(sets, ", "), vals, nil
}

func TableRowExistsByID(table string, id interface{}) bool {
	quotedTable, err := quoteSQLIdentifier(table)
	if err != nil {
		return false
	}
	var exists int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE id = ?", quotedTable)
	return DB.Get(&exists, query, id) == nil && exists > 0
}
