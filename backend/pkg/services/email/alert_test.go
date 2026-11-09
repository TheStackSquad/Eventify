// backend/pkg/services/email/alert_test.go

package email

import (
	"context"
	"testing"
)

// An alert must never be able to fail the work it is reporting on.
func TestQueueAdminAlertNeverFailsTheCaller(t *testing.T) {
	if err := QueueAdminAlert(context.Background(), nil, "needs_review", "ref-1", "paid 1000000, expected 1000100"); err != nil {
		t.Fatalf("an alert must not return an error: %v", err)
	}
}