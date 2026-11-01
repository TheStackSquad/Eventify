// backend/pkg/utils/frontend_url.go

package utils

import (
	"errors"
	"os"
	"strings"
)

var ErrFrontendURLNotSet = errors.New("FRONTEND_BASE_URL is not set")

// FrontendBaseURL is the public frontend address used in payment callbacks and emails.
// FRONTEND_BASE_URL is the name to use; FRONTEND_URL is still read so existing setups keep working.
func FrontendBaseURL() (string, error) {
	for _, k := range []string{"FRONTEND_BASE_URL", "FRONTEND_URL"} {
		if v := strings.TrimRight(strings.TrimSpace(os.Getenv(k)), "/"); v != "" {
			return v, nil
		}
	}
	return "", ErrFrontendURLNotSet
}