//backend/pkg/services/subscription/webhook_retry_test.go

package subscription

import (
	"errors"
	"fmt"
	"testing"
)

func TestIsRetryableWebhookRules(t *testing.T) {
	mustRetry := map[string]error{
		"unreadable signed body": fmt.Errorf("%w: boom", ErrBadWebhookPayload),
		"database down":          errors.New("connection refused"),
	}
	for name, err := range mustRetry {
		if !IsRetryable(err) {
			t.Errorf("%s: Paystack must be asked to retry", name)
		}
	}
	mustNotRetry := map[string]error{
		"bad signature":     ErrInvalidSignature,
		"unpaid":            ErrPaymentNotSuccessful,
		"held for review":   ErrPaymentNeedsReview,
		"unknown reference": fmt.Errorf("%w: reference x", ErrPaymentNotOwned),
	}
	for name, err := range mustNotRetry {
		if IsRetryable(err) {
			t.Errorf("%s: retrying cannot help", name)
		}
	}
}