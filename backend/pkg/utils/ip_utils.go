// backend/pkg/utils/ip_utils.go
package utils

import "net/http"

// GetClientIP extracts the client's IP from HTTP headers or RemoteAddr
func GetClientIP(r *http.Request) string {
	// Try common proxy headers
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}
