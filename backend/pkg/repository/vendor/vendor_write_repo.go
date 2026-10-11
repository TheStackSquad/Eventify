// backend/pkg/repository/vendor/vendor_write_repo.go
package vendor

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

func (r *PostgresVendorRepository) Create(ctx context.Context, v *models.Vendor) (uuid.UUID, error) {
	if v == nil {
		return uuid.Nil, errors.New("vendor is nil")
	}

	now := time.Now()
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	v.CreatedAt, v.UpdatedAt = now, now

	query := `
        INSERT INTO vendors (
            id, owner_id, name, category, description, image_url, status,
            vnin, first_name, middle_name, last_name,
            is_identity_verified, cac_number, is_business_verified, 
            state, city, phone_number, email,
            min_price, pvs_score, review_count, profile_completion,
            inquiry_count, responded_count, created_at, updated_at
        ) VALUES (
            :id, :owner_id, :name, :category, :description, :image_url, :status,
            :vnin, :first_name, :middle_name, :last_name,
            :is_identity_verified, :cac_number, :is_business_verified,
            :state, :city, :phone_number, :email,
            :min_price, :pvs_score, :review_count, :profile_completion,
            :inquiry_count, :responded_count, :created_at, :updated_at
        ) RETURNING id`

	// Using sqlx.NamedStmt or simpler QueryRow to avoid row leaks
	stmt, err := r.DB.PrepareNamedContext(ctx, query)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	var newID uuid.UUID
	err = stmt.QueryRowContext(ctx, v).Scan(&newID)
	if err != nil {
		return uuid.Nil, r.handlePostgresError(err, "create")
	}

	log.Info().Str("vendor_id", newID.String()).Str("vendor_name", v.Name).Msg("Vendor created successfully")
	return newID, nil
}

func (r *PostgresVendorRepository) Update(ctx context.Context, v *models.Vendor) error {
	v.UpdatedAt = time.Now()
	query := `
        UPDATE vendors SET
            name = :name, category = :category, description = :description, image_url = :image_url,
            status = :status, vnin = :vnin, first_name = :first_name, middle_name = :middle_name,
            last_name = :last_name,
            is_identity_verified = :is_identity_verified, cac_number = :cac_number,
            is_business_verified = :is_business_verified, state = :state, city = :city,
            phone_number = :phone_number, email = :email, min_price = :min_price,
            pvs_score = :pvs_score, updated_at = :updated_at
        WHERE id = :id AND owner_id = :owner_id`

	result, err := r.DB.NamedExecContext(ctx, query, v)
	if err != nil {
		return r.handlePostgresError(err, "update")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("vendor not found or unauthorized")
	}

	log.Info().Str("vendor_id", v.ID.String()).Msg("Vendor updated successfully")
	return nil
}

// UpdateFields handles partial updates (like status toggles)
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
	args = append(args, id)

	query := fmt.Sprintf("UPDATE vendors SET %s WHERE id = $%d", strings.Join(setClauses, ", "), argCounter)
	result, err := r.DB.ExecContext(ctx, query, args...)

	if err != nil {
		return r.handlePostgresError(err, "update_fields")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("no record found to update")
	}

	log.Info().Str("vendor_id", id.String()).Int64("rows_affected", rows).Msg("Vendor fields updated")
	return nil
}

// Internal helper for graceful error handling
func (r *PostgresVendorRepository) handlePostgresError(err error, op string) error {
	if pqErr, ok := err.(*pq.Error); ok {
		switch pqErr.Code {
		case "23505": // unique_violation
			return fmt.Errorf("a vendor with this information already exists (duplicate key)")
		case "23502": // not_null_violation
			return fmt.Errorf("missing required field: %s", pqErr.Column)
		case "22P02": // invalid_text_representation (bad UUID/Enum)
			return fmt.Errorf("invalid data format provided for %s", op)
		}
	}
	log.Error().Err(err).Str("operation", op).Msg("Database operation failed")
	return fmt.Errorf("database error during %s: %w", op, err)
}


func (r *PostgresVendorRepository) UpdateVerificationFlag(ctx context.Context, id uuid.UUID, field string, isVerified bool, reason string) error {
	if field != "is_identity_verified" && field != "is_business_verified" {
		return errors.New("invalid verification field")
	}
	query := fmt.Sprintf("UPDATE vendors SET %s = $1, updated_at = $2 WHERE id = $3", field)
	_, err := r.DB.ExecContext(ctx, query, isVerified, time.Now(), id)
	return err
}

func (r *PostgresVendorRepository) UpdatePVSScore(ctx context.Context, id uuid.UUID, score int) error {
	query := `UPDATE vendors SET pvs_score = $1, updated_at = $2 WHERE id = $3`
	_, err := r.DB.ExecContext(ctx, query, score, time.Now(), id)
	return err
}

func (r *PostgresVendorRepository) IncrementField(ctx context.Context, id uuid.UUID, field string, delta int) error {
	if field != "inquiry_count" && field != "responded_count" && field != "review_count" {
		return errors.New("invalid field for increment")
	}
	query := fmt.Sprintf("UPDATE vendors SET %s = %s + $1, updated_at = $2 WHERE id = $3", field, field)
	_, err := r.DB.ExecContext(ctx, query, delta, time.Now(), id)
	return err
}

func (r *PostgresVendorRepository) Delete(ctx context.Context, id uuid.UUID) (int64, error) {
    query := `
        UPDATE vendors 
        SET deleted_at = NOW(), 
            status     = 'deleted',
            updated_at = NOW() 
        WHERE id = $1 
        AND deleted_at IS NULL
    `
    res, err := r.DB.ExecContext(ctx, query, id)
    if err != nil {
        return 0, fmt.Errorf("failed to soft delete vendor: %w", err)
    }
    return res.RowsAffected()
}

