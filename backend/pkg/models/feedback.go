// backend/pkg/models/feedback.go
package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type FeedbackType string

const (
	FeedbackTypeSuggestion FeedbackType = "suggestion"
	FeedbackTypeComplaint  FeedbackType = "complaint"
	FeedbackTypeFeedback   FeedbackType = "feedback"
)

// NullableString is a helper type for optional string fields that handles empty strings
type NullableString struct {
	Value string
	Valid bool
}

// UnmarshalJSON implements custom JSON unmarshaling for NullableString
func (ns *NullableString) UnmarshalJSON(data []byte) error {
	// Handle null
	if string(data) == "null" {
		ns.Valid = false
		ns.Value = ""
		return nil
	}

	// Unmarshal as string
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	// Empty string is treated as invalid/null
	if s == "" {
		ns.Valid = false
		ns.Value = ""
	} else {
		ns.Valid = true
		ns.Value = s
	}

	return nil
}

// MarshalJSON implements custom JSON marshaling for NullableString
func (ns NullableString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.Value)
}

type Feedback struct {
	ID        uuid.UUID           `json:"id" db:"id"`
	UserID    sql.Null[uuid.UUID] `json:"userId,omitempty" db:"user_id"`
	GuestID   string              `json:"guestId" db:"guest_id"`
	Type      FeedbackType        `json:"type" db:"type"`
	Message   string              `json:"message" db:"message"`
	ImageURL  sql.NullString      `json:"imageUrl,omitempty" db:"image_url"`
	Name      string              `json:"name" db:"name"`
	Email     string              `json:"email" db:"email"`
	CreatedAt time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time           `json:"updatedAt" db:"updated_at"`
}

// CreateFeedbackRequest is the request payload for creating feedback
type CreateFeedbackRequest struct {
	Type     FeedbackType   `json:"type" binding:"required,oneof=suggestion complaint feedback"`
	Message  string         `json:"message" binding:"required,min=1,max=2000"`
	ImageURL NullableString `json:"imageUrl"` // Custom type handles null/empty gracefully
	Name     string         `json:"name" binding:"required,min=1,max=100"`
	Email    string         `json:"email" binding:"required,email"`
}

// FeedbackResponse is the response payload for feedback
type FeedbackResponse struct {
	ID        string       `json:"id"`
	UserID    *string      `json:"userId,omitempty"`
	GuestID   string       `json:"guestId"`
	Type      FeedbackType `json:"type"`
	Message   string       `json:"message"`
	ImageURL  *string      `json:"imageUrl,omitempty"`
	Name      string       `json:"name"`
	Email     string       `json:"email"`
	CreatedAt time.Time    `json:"createdAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

// ToResponse converts a Feedback model to FeedbackResponse
func (f *Feedback) ToResponse() FeedbackResponse {
	response := FeedbackResponse{
		ID:        f.ID.String(),
		GuestID:   f.GuestID,
		Type:      f.Type,
		Message:   f.Message,
		Name:      f.Name,
		Email:     f.Email,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}

	// Handle optional UserID
	if f.UserID.Valid {
		userIDStr := f.UserID.V.String()
		response.UserID = &userIDStr
	}

	// Handle optional ImageURL
	if f.ImageURL.Valid && f.ImageURL.String != "" {
		response.ImageURL = &f.ImageURL.String
	}

	return response
}

// ToSQLNullString converts a NullableString to sql.NullString
func ToSQLNullString(ns NullableString) sql.NullString {
	if !ns.Valid || ns.Value == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: ns.Value, Valid: true}
}

// Validate checks if the feedback type is valid
func (r *CreateFeedbackRequest) Validate() error {
	if r.Type != FeedbackTypeSuggestion &&
		r.Type != FeedbackTypeComplaint &&
		r.Type != FeedbackTypeFeedback {
		return ErrInvalidFeedbackType
	}
	
	// Additional validation for imageUrl if present
	if r.ImageURL.Valid && len(r.ImageURL.Value) > 500 {
		return NewValidationError("image URL too long (max 500 characters)")
	}
	
	return nil
}

// Custom errors
var (
	ErrInvalidFeedbackType = NewValidationError("invalid feedback type: must be 'suggestion', 'complaint', or 'feedback'")
	ErrFeedbackNotFound    = NewNotFoundError("feedback not found")
)

// ValidationError represents a validation error
type ValidationError struct {
	message string
}

func (e ValidationError) Error() string {
	return e.message
}

func NewValidationError(msg string) ValidationError {
	return ValidationError{message: msg}
}

// NotFoundError represents a not found error
type NotFoundError struct {
	message string
}

func (e NotFoundError) Error() string {
	return e.message
}

func NewNotFoundError(msg string) NotFoundError {
	return NotFoundError{message: msg}
}