// backend/pkg/repository/inquiries/inquiries_write_repo.go

package inquiries

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresInquiryWriteRepository implements InquiryWriteRepository with PostgreSQL.
type PostgresInquiryWriteRepository struct {
	DB *sqlx.DB
}

// Create inserts a new inquiry into the table.
func (r *PostgresInquiryWriteRepository) Create(ctx context.Context, inquiry *models.Inquiry) error {
	if inquiry == nil {
		return errors.New("inquiry is nil")
	}

	if inquiry.ID == uuid.Nil {
		inquiry.ID = uuid.New()
	}

	now := time.Now()
	inquiry.CreatedAt = now
	inquiry.UpdatedAt = now

	if inquiry.UserID == nil && inquiry.GuestID == "" {
		return errors.New("inquiry must have a userId or guestId")
	}

	query := `
		INSERT INTO inquiries (
			id, vendor_id, user_id, guest_id, name, email, 
			message, ip_address, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.DB.ExecContext(ctx, query,
		inquiry.ID,
		inquiry.VendorID,
		inquiry.UserID,
		inquiry.GuestID,
		inquiry.Name,
		inquiry.Email,
		inquiry.Message,
		inquiry.IPAddress,
		inquiry.CreatedAt,
		inquiry.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create inquiry: %w", err)
	}

	return nil
}

// Delete removes an inquiry by its ID.
func (r *PostgresInquiryWriteRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.DB.ExecContext(ctx, "DELETE FROM inquiries WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete inquiry: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return errors.New("inquiry not found for deletion")
	}

	return nil
}

// UpdateFields performs partial updates on an inquiry.
func (r *PostgresInquiryWriteRepository) UpdateFields(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	updates["updated_at"] = time.Now()

	setClauses := ""
	args := []interface{}{}
	i := 1

	for key, value := range updates {
		if setClauses != "" {
			setClauses += ", "
		}
		setClauses += fmt.Sprintf("%s = $%d", key, i)
		args = append(args, value)
		i++
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE inquiries SET %s WHERE id = $%d", setClauses, i)

	result, err := r.DB.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update inquiry: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return errors.New("inquiry not found for update")
	}

	return nil
}