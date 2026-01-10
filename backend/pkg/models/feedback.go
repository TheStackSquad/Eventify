// backend/pkg/models/feedback.go
package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type FeedbackType string

const (
	FeedbackTypeSuggestion FeedbackType = "suggestion"
	FeedbackTypeComplaint  FeedbackType = "complaint"
	FeedbackTypeFeedback   FeedbackType = "feedback"
)

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
	Type     FeedbackType   `json:"type" binding:"required"`
	Message  string         `json:"message" binding:"required"`
	ImageURL sql.NullString `json:"imageUrl,omitempty"`
	Name     string         `json:"name" binding:"required"`
	Email    string         `json:"email" binding:"required,email"`
}

// FeedbackResponse is the response payload for feedback
type FeedbackResponse struct {
	ID        string       `json:"id"`
	UserID    *string      `json:"userId,omitempty"`
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
	if f.ImageURL.Valid {
		response.ImageURL = &f.ImageURL.String
	}

	return response
}

// Validate checks if the feedback type is valid
func (r *CreateFeedbackRequest) Validate() error {
	if r.Type != FeedbackTypeSuggestion &&
		r.Type != FeedbackTypeComplaint &&
		r.Type != FeedbackTypeFeedback {
		return ErrInvalidFeedbackType
	}
	return nil
}

// Custom errors
var (
	ErrInvalidFeedbackType = NewValidationError("invalid feedback type")
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