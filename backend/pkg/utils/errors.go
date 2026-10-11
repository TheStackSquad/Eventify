//backend/pkg/utils/errors.go

package utils

import (
	"errors"
	"fmt"
	"net/http"
)

// Sentinel error variables
var (
	ErrOrderAlreadyProcessed = errors.New("order already processed")
	ErrInvalidReference      = errors.New("invalid payment reference")
	ErrAmountMismatch        = errors.New("payment amount mismatch")
	ErrPaymentFailed         = errors.New("payment verification failed")
	ErrMetadataParsing       = errors.New("failed to parse payment metadata")
	ErrInvalidInput          = errors.New("invalid input")
	ErrInternal              = errors.New("internal error")
	ErrNotFound              = errors.New("resource not found")
	ErrUnauthorized          = errors.New("unauthorized access")
	ErrInsufficientStock 	 = errors.New("insufficient stock for requested items")
)


// Error categories
const (
	ErrCategoryValidation = "validation_error"
	ErrCategoryPayment    = "payment_error"
	ErrCategoryDatabase   = "database_error"
	ErrCategoryExternal   = "external_api_error"
	ErrConflict           = "conflict_error"
	ErrCategoryInternal   = "internal_error"
	ErrCategoryAuth       = "auth_error"
)

// AppError represents a structured application error
type AppError struct {
	Category string
	Message  string
	Err      error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s - %v", e.Category, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Category, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// HTTPStatus returns the appropriate HTTP status code based on the error category
func (e *AppError) HTTPStatus() int {
	switch e.Category {
	case ErrCategoryValidation:
		return http.StatusBadRequest // 400
	case ErrCategoryAuth:
		return http.StatusUnauthorized // 401
	case ErrCategoryPayment:
		return http.StatusPaymentRequired // 402
	case ErrConflict:
		return http.StatusConflict // 409
	case ErrCategoryDatabase:
		return http.StatusInternalServerError // 500
	case ErrCategoryExternal:
		return http.StatusBadGateway // 502
	case ErrCategoryInternal:
		return http.StatusInternalServerError // 500
	default:
		return http.StatusInternalServerError // 500
	}
}

// NewError creates a new AppError
func NewError(category, message string, err error) *AppError {
	return &AppError{
		Category: category,
		Message:  message,
		Err:      err,
	}
}

// IsConflictError checks if an error is a conflict error
func IsConflictError(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Category == ErrConflict
	}
	return false
}

// IsValidationError checks if an error is a validation error
func IsValidationError(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Category == ErrCategoryValidation
	}
	return false
}

// IsAuthError checks if an error is an authentication error
func IsAuthError(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Category == ErrCategoryAuth
	}
	return false
}

func NewConflictError(message string, err error) *AppError {
	return NewError(ErrConflict, message, err)
}