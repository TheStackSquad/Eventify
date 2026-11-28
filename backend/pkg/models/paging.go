// backend/pkg/models/paging.go

// backend/pkg/models/paging.go
package models

import "strconv"

const (
	pagingDefaultLimit = 12
	pagingMaxLimit     = 48
	pagingMaxPage      = 1000
)

// ClampPaging turns raw query-string values into a safe page (>= 1) and page size
// (1..48). Anything missing or malformed falls back to the defaults.
func ClampPaging(pageRaw, limitRaw string) (page, limit int) {
	page, limit = 1, pagingDefaultLimit
	if n, err := strconv.Atoi(pageRaw); err == nil && n >= 1 {
		page = n
	}
	if page > pagingMaxPage {
		page = pagingMaxPage
	}
	if n, err := strconv.Atoi(limitRaw); err == nil && n >= 1 {
		limit = n
	}
	if limit > pagingMaxLimit {
		limit = pagingMaxLimit
	}
	return page, limit
}