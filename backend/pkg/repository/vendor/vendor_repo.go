// backend/pkg/repository/vendor/vendor_repo.go
package vendor

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VendorRepository interface {
	Create(ctx context.Context, vendor *models.Vendor) (uuid.UUID, error)
	GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error)
	UpdateVerificationFlag(ctx context.Context, id uuid.UUID, field string, isVerified bool, reason string) error
	UpdatePVSScore(ctx context.Context, id uuid.UUID, score int) error
	Delete(ctx context.Context, id uuid.UUID) (int64, error)
	UpdateFields(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
	IncrementField(ctx context.Context, id uuid.UUID, field string, delta int) error
	GetByID(ctx context.Context, id uuid.UUID) (models.Vendor, error)
	FindPublicVendors(ctx context.Context, filters map[string]string) ([]models.Vendor, error)
}

type PostgresVendorRepository struct {
	DB *sqlx.DB
}

func NewPostgresVendorRepository(db *sqlx.DB) VendorRepository {
	return &PostgresVendorRepository{DB: db}
}

func (r *PostgresVendorRepository) GetByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
	query := `
		SELECT id, owner_id, name, category, description, image_url, status,
		       vnin, first_name, middle_name, last_name, date_of_birth, gender,
		       is_identity_verified, state, city, phone_number, email,
		       min_price, pvs_score, review_count, profile_completion,
		       inquiry_count, responded_count, created_at, updated_at
		FROM vendors
		WHERE owner_id = $1
		LIMIT 1`

	var vendor models.Vendor
	err := r.DB.GetContext(ctx, &vendor, query, ownerID)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get vendor by owner_id: %w", err)
	}
	return &vendor, nil
}

func (r *PostgresVendorRepository) Create(ctx context.Context, v *models.Vendor) (uuid.UUID, error) {
	if v == nil {
		return uuid.Nil, errors.New("vendor is nil")
	}

	now := time.Now()
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	v.CreatedAt = now
	v.UpdatedAt = now

	// ADDED: cac_number, is_business_verified to ensure registration captures everything
	query := `
		INSERT INTO vendors (
			id, owner_id, name, category, description, image_url, status,
			vnin, first_name, middle_name, last_name, date_of_birth, gender,
			is_identity_verified, cac_number, is_business_verified, 
			state, city, phone_number, email,
			min_price, pvs_score, review_count, profile_completion,
			inquiry_count, responded_count, created_at, updated_at
		) VALUES (
			:id, :owner_id, :name, :category, :description, :image_url, :status,
			:vnin, :first_name, :middle_name, :last_name, :date_of_birth, :gender,
			:is_identity_verified, :cac_number, :is_business_verified,
			:state, :city, :phone_number, :email,
			:min_price, :pvs_score, :review_count, :profile_completion,
			:inquiry_count, :responded_count, :created_at, :updated_at
		) RETURNING id`

	rows, err := r.DB.NamedQueryContext(ctx, query, v)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to insert vendor: %w", err)
	}
	defer rows.Close()

	var newID uuid.UUID
	if rows.Next() {
		if err := rows.Scan(&newID); err != nil {
			return uuid.Nil, fmt.Errorf("failed to scan returned id: %w", err)
		}
	}
	return newID, nil
}

func (r *PostgresVendorRepository) IncrementField(ctx context.Context, id uuid.UUID, field string, delta int) error {
    // Whitelist check including review_count
	if field != "inquiry_count" && field != "responded_count" && field != "review_count" {
		return errors.New("invalid field for increment operation")
	}

	query := fmt.Sprintf(`
		UPDATE vendors
		SET %s = %s + $1, updated_at = $2
		WHERE id = $3
	`, field, field)

	result, err := r.DB.ExecContext(ctx, query, delta, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to increment field %s: %w", field, err)
	}
    
    rows, _ := result.RowsAffected()
    if rows == 0 {
        return errors.New("vendor not found")
    }
	return nil
}

func (r *PostgresVendorRepository) UpdateFields(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	updates["updated_at"] = time.Now()
	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+1)
	argCounter := 1

	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, argCounter))
		args = append(args, v)
		argCounter++
	}

	setQuery := "SET " + strings.Join(setClauses, ", ")
	args = append(args, id)
	query := fmt.Sprintf("UPDATE vendors %s WHERE id = $%d", setQuery, argCounter)

	result, err := r.DB.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update vendor fields: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("vendor not found or no changes made")
	}
	return nil
}

func (r *PostgresVendorRepository) Delete(ctx context.Context, id uuid.UUID) (int64, error) {
	query := `DELETE FROM vendors WHERE id = $1`
	result, err := r.DB.ExecContext(ctx, query, id)
	if err != nil {
		return 0, fmt.Errorf("failed to delete vendor: %w", err)
	}
	deletedCount, _ := result.RowsAffected()
	return deletedCount, nil
}

func (r *PostgresVendorRepository) GetByID(ctx context.Context, id uuid.UUID) (models.Vendor, error) {
	var vendor models.Vendor
	query := `SELECT * FROM vendors WHERE id = $1`
	err := r.DB.GetContext(ctx, &vendor, query, id)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Vendor{}, errors.New("vendor not found")
		}
		return models.Vendor{}, fmt.Errorf("failed to get vendor by ID: %w", err)
	}
	return vendor, nil
}

func (r *PostgresVendorRepository) FindPublicVendors(ctx context.Context, filters map[string]string) ([]models.Vendor, error) {
	var vendors []models.Vendor
	whereClauses := []string{"status = $1"}
	args := []interface{}{models.StatusActive}
	argCounter := 2

	for key, value := range filters {
		if value == "" || key == "page" || key == "limit" {
			continue
		}
		switch key {
		case "min_price":
			whereClauses = append(whereClauses, fmt.Sprintf("min_price >= $%d", argCounter))
			args = append(args, value)
			argCounter++
		case "category", "state", "city":
			whereClauses = append(whereClauses, fmt.Sprintf("%s = $%d", key, argCounter))
			args = append(args, value)
			argCounter++
		}
	}

	query := `
		SELECT
			id,
			owner_id,
			name,
			category,
			COALESCE(description, '') as description,
			COALESCE(image_url, '') as image_url,
			status,
			vnin,
			first_name,
			COALESCE(middle_name, '') as middle_name,
			last_name,
			date_of_birth,
			gender,
			is_identity_verified,
			state,
			city,
			phone_number,
			COALESCE(email, '') as email,
			min_price,
			pvs_score,
			review_count,
			profile_completion,
			inquiry_count,
			responded_count,
			created_at,
			updated_at
		FROM vendors
		WHERE ` + strings.Join(whereClauses, " AND ")

	query += " ORDER BY is_identity_verified DESC, pvs_score DESC, created_at DESC"
	err := r.DB.SelectContext(ctx, &vendors, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to find public vendors: %w", err)
	}
	return vendors, nil
}

func (r *PostgresVendorRepository) UpdateVerificationFlag(ctx context.Context, id uuid.UUID, field string, isVerified bool, reason string) error {
	// ALIGNED: Ensured whitelist matches service field names
	if field != "is_identity_verified" && field != "is_business_verified" {
		return errors.New("invalid field for verification update")
	}

	// We use fmt.Sprintf for the field name safely here because of the whitelist check above
	query := fmt.Sprintf(`
		UPDATE vendors
		SET %s = $1, updated_at = $2
		WHERE id = $3
	`, field)

	result, err := r.DB.ExecContext(ctx, query, isVerified, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update verification flag: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("vendor not found")
	}
	return nil
}

func (r *PostgresVendorRepository) UpdatePVSScore(ctx context.Context, id uuid.UUID, score int) error {
	query := `
		UPDATE vendors
		SET pvs_score = $1, updated_at = $2
		WHERE id = $3
	`
	result, err := r.DB.ExecContext(ctx, query, score, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update PVS score: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("vendor not found or score already set")
	}
	return nil
}