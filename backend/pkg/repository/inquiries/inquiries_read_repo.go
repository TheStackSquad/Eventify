// backend/pkg/repository/inquiries/inquiries_read_repo.go

package inquiries

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresInquiryReadRepository implements InquiryReadRepository with PostgreSQL.
type PostgresInquiryReadRepository struct {
	DB *sqlx.DB
}

// scanInquiry scans a single inquiry row from the database.
func scanInquiry(row *sql.Row, inquiry *models.Inquiry) error {
	return row.Scan(
		&inquiry.ID,
		&inquiry.VendorID,
		&inquiry.UserID,
		&inquiry.GuestID,
		&inquiry.Name,
		&inquiry.Email,
		&inquiry.Message,
		&inquiry.IPAddress,
		&inquiry.CreatedAt,
		&inquiry.UpdatedAt,
		&inquiry.TrustWeight,
	)
}

// FindByID fetches a single inquiry by its ID.
func (r *PostgresInquiryReadRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Inquiry, error) {
	query := `
		SELECT 
			id, vendor_id, user_id, guest_id, name, email, message, 
			ip_address, created_at, updated_at, trust_weight
		FROM inquiries
		WHERE id = $1
	`

	var inquiry models.Inquiry
	row := r.DB.QueryRowContext(ctx, query, id)
	
	err := scanInquiry(row, &inquiry)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find inquiry by ID: %w", err)
	}
	
	return &inquiry, nil
}

// GetByVendorID fetches inquiries for a vendor.
func (r *PostgresInquiryReadRepository) GetByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Inquiry, error) {
	query := `
		SELECT 
			id, vendor_id, user_id, guest_id, name, email, message, 
			ip_address, created_at, updated_at, trust_weight
		FROM inquiries
		WHERE vendor_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.DB.QueryContext(ctx, query, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get inquiries by vendor ID: %w", err)
	}
	defer rows.Close()

	var inquiries []models.Inquiry
	for rows.Next() {
		var inquiry models.Inquiry
		
		err := rows.Scan(
			&inquiry.ID,
			&inquiry.VendorID,
			&inquiry.UserID,
			&inquiry.GuestID,
			&inquiry.Name,
			&inquiry.Email,
			&inquiry.Message,
			&inquiry.IPAddress,
			&inquiry.CreatedAt,
			&inquiry.UpdatedAt,
			&inquiry.TrustWeight,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan inquiry row: %w", err)
		}
		
		inquiries = append(inquiries, inquiry)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over inquiry rows: %w", err)
	}

	return inquiries, nil
}