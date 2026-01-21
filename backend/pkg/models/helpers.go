//backend/pkg/models/helpers.go
package models

import (
	"database/sql"
	"github.com/google/uuid"
	"time"
)

// NullUUID is a wrapper for nullable UUIDs
type NullUUID sql.Null[uuid.UUID]

// ToNullUUID converts a uuid.UUID to a models.NullUUID
func ToNullUUID(id uuid.UUID) NullUUID {
	return NullUUID{
		V:     id,
		Valid: id != uuid.Nil,
	}
}

// ToNullInt32 converts an int32 to a sql.NullInt32
func ToNullInt32(val int32) sql.NullInt32 {
	return sql.NullInt32{
		Int32: val,
		Valid: val > 0,
	}
}

// ToNullString converts a string to a sql.NullString
func ToNullString(val string) sql.NullString {
	return sql.NullString{
		String: val,
		Valid:  val != "",
	}
}

// ToNullTime converts a *time.Time to a sql.NullTime
func ToNullTime(t *time.Time) sql.NullTime {
	if t == nil || t.IsZero() {
		return sql.NullTime{Valid: false}
	}
	return sql.NullTime{
		Time:  *t,
		Valid: true,
	}
}

// ToNullTimeFromString converts a date string (YYYY-MM-DD) to a sql.NullTime
func ToNullTimeFromString(val string) sql.NullTime {
	if val == "" {
		return sql.NullTime{Valid: false}
	}
	
	// Layout for "YYYY-MM-DD"
	t, err := time.Parse("2006-01-02", val)
	if err != nil {
		// Log error if necessary or just return invalid
		return sql.NullTime{Valid: false}
	}
	
	return sql.NullTime{
		Time:  t,
		Valid: true,
	}
}

// ToNullBool converts a bool to a sql.NullBool
func ToNullBool(val bool) sql.NullBool {
    return sql.NullBool{
        Bool:  val,
        Valid: true, // In most registration cases, we treat the sent value as intentional
    }
}