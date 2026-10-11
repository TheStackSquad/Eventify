// backend/pkg/utils/json.go

package utils

import (
	"encoding/json"
	"io"
	"fmt"
)

// DecodeJSON reads from an io.Reader (like an http.Response body) and decodes 
// the JSON content into the provided interface{} target.
func DecodeJSON(r io.Reader, target interface{}) error {
	// Use json.NewDecoder for streaming/safer decoding of unknown size
	decoder := json.NewDecoder(r)
	
	// Ensure decoding strictly follows the struct fields
//	decoder.DisallowUnknownFields() 
	
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("failed to decode JSON: %w", err)
	}
	return nil
}