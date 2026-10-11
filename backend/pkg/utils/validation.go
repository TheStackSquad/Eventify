//backend/pkg/utils/validation.go

package utils

import (
	"fmt"
	"github.com/go-playground/validator/v10"
)

// GetValidationErrors takes a binding error (if it's a validation error)
// and returns a map of field names to error messages.
func GetValidationErrors(err error) map[string]string {
	// Check if the error can be cast to ValidationErrors
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		errors := make(map[string]string)
		for _, fieldError := range validationErrors {
			// Extract the JSON tag name for the field
			fieldName := fieldError.Field() // This is usually the struct field name
            // You may need more complex logic to get the JSON tag name (e.g., eventTitle)
            // but for simplicity, we start with the basic field name.

			errors[fieldName] = fmt.Sprintf("Field %s failed validation on tag '%s'", fieldName, fieldError.Tag())
		}
		return errors
	}
    
	// If it's not a validation error (e.g., malformed JSON), return a generic error
	return map[string]string{"general": err.Error()}
}