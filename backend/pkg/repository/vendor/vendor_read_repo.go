//backend/pkg/repository/vendor/vendor_read_repo.go

package vendor

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// vendorAvgJoin adds the real average of each vendor's review ratings (1-5).
// reviews has an index on (vendor_id, rating), so the aggregate is cheap at this scale.
const vendorAvgJoin = `
LEFT JOIN (
    SELECT vendor_id, ROUND(AVG(rating)::numeric, 2)::float8 AS avg_rating
    FROM reviews
    GROUP BY vendor_id
) r ON r.vendor_id = v.id`

// vendorSelect: every vendor column plus avg_rating.
const vendorSelect = `SELECT v.*, r.avg_rating FROM vendors v` + vendorAvgJoin

// vendorListSelect: the same, plus the number of matching rows before LIMIT/OFFSET.
const vendorListSelect = `SELECT v.*, r.avg_rating, COUNT(*) OVER() AS total_count FROM vendors v` + vendorAvgJoin

// vendorOrders maps the sort names the API accepts to SQL. Only these strings ever reach a query.
var vendorOrders = map[string]string{
	"rating":     "r.avg_rating DESC NULLS LAST, pvs_score DESC, created_at DESC",
	"trust":      "pvs_score DESC, created_at DESC",
	"reviews":    "review_count DESC, pvs_score DESC",
	"price_low":  "min_price ASC NULLS LAST, pvs_score DESC",
	"price_high": "min_price DESC NULLS LAST, pvs_score DESC",
	"newest":     "created_at DESC",
	"name":       "LOWER(name) ASC",
}

// vendorOrderAliases lets friendlier or older front-end values map onto the names above.
var vendorOrderAliases = map[string]string{
	"top_rated": "rating", "highest_rated": "rating", "avg_rating": "rating", "avgrating": "rating",
	"pvs": "trust", "pvs_score": "trust", "pvsscore": "trust", "score": "trust",
	"popular": "reviews", "most_reviewed": "reviews", "review_count": "reviews",
	"price_asc": "price_low", "lowest_price": "price_low", "price-low": "price_low", "min_price": "price_low",
	"price_desc": "price_high", "highest_price": "price_high", "price-high": "price_high",
	"recent": "newest", "latest": "newest", "created_at": "newest",
	"a-z": "name", "name_asc": "name",
}

const defaultVendorOrder = "is_identity_verified DESC, pvs_score DESC, created_at DESC"

func buildVendorOrder(sortBy string) string {
	key := strings.ToLower(strings.TrimSpace(sortBy))
	if alias, ok := vendorOrderAliases[key]; ok {
		key = alias
	}
	if order, ok := vendorOrders[key]; ok {
		return order
	}
	return defaultVendorOrder
}

// escapeLike makes user text match literally inside ILIKE.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (r *PostgresVendorRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Vendor, error) {
	var v models.Vendor
	err := r.DB.GetContext(ctx, &v, vendorSelect+` WHERE v.id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("vendor not found")
		}
		return nil, err
	}
	return &v, nil
}

func (r *PostgresVendorRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
	var v models.Vendor
	err := r.DB.GetContext(ctx, &v, vendorSelect+` WHERE v.owner_id = $1 AND v.deleted_at IS NULL LIMIT 1`, ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *PostgresVendorRepository) IsRegisteredVendor(ctx context.Context, ownerID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM vendors WHERE owner_id = $1)`
	err := r.DB.GetContext(ctx, &exists, query, ownerID)
	return exists, err
}

// FindPublicVendors returns one page of active vendors. Recognised filters (all strings):
// category, state, city, min_price, location (state or city), search, sortBy, page, limit.
// Every matching vendor row carries total_count (the number of matches before paging).
func (r *PostgresVendorRepository) FindPublicVendors(ctx context.Context, filters map[string]string) ([]models.Vendor, error) {
	var vendors []models.Vendor

	where := []string{"status = $1", "deleted_at IS NULL"}
	args := []interface{}{models.VendorStatusActive}
	// add appends one argument and puts its $n number wherever the clause has a "?".
	add := func(clause string, value interface{}) {
		args = append(args, value)
		where = append(where, strings.ReplaceAll(clause, "?", fmt.Sprintf("$%d", len(args))))
	}

	for _, key := range []string{"category", "state", "city"} { // fixed list: safe to use as column names
		if v := strings.TrimSpace(filters[key]); v != "" {
			add(key+" = ?", v)
		}
	}

	if v := strings.TrimSpace(filters["min_price"]); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			add("min_price >= ?", n)
		}
	}

	if v := strings.TrimSpace(filters["location"]); v != "" {
		add("(state ILIKE ? OR city ILIKE ?)", "%"+escapeLike(v)+"%")
	}

	if v := strings.TrimSpace(filters["search"]); v != "" {
		if runes := []rune(v); len(runes) > 80 {
			v = string(runes[:80])
		}
		add("(name ILIKE ? OR description ILIKE ? OR city ILIKE ? OR category ILIKE ?)", "%"+escapeLike(v)+"%")
	}

	sortKey := filters["sortBy"]
	if sortKey == "" {
		sortKey = filters["sort"]
	}

	page, limit := models.ClampPaging(filters["page"], filters["limit"])
	args = append(args, limit, (page-1)*limit)

	query := vendorListSelect + ` WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY ` + buildVendorOrder(sortKey) + `, v.id` + // v.id keeps pages stable when scores tie
		fmt.Sprintf(` LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	err := r.DB.SelectContext(ctx, &vendors, query, args...)
	return vendors, err
}