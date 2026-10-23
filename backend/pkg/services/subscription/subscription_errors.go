//backend/pkg/services/subscription/subscription_errors.go

package subscription

import (
	"github.com/eventify/backend/pkg/services/paystack"
	"errors"
)

var (
	ErrFreeTier            = errors.New("cannot subscribe to free tier via payment gateway")
	ErrInvalidTier         = errors.New("invalid subscription tier")
	ErrActiveDifferentTier = errors.New("you already have an active plan on a different tier; renew that tier or wait for it to expire")
	ErrGatewayUnavailable  = errors.New("payment gateway unavailable")
	ErrPaymentNotOwned      = errors.New("payment not found")
	ErrPaymentNotSuccessful = errors.New("payment was not successful")
	ErrPaymentNeedsReview   = errors.New("payment received but held for manual review")
	ErrInvalidSignature  = errors.New("invalid signature")
	ErrBadWebhookPayload = errors.New("malformed webhook payload")
)

func IsRetryable(err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, ErrInvalidSignature), 
		 errors.Is(err, ErrBadWebhookPayload),
		 errors.Is(err, ErrPaymentNotSuccessful), 
		 errors.Is(err, ErrPaymentNeedsReview),
		 errors.Is(err, ErrPaymentNotOwned), 
		 errors.Is(err, paystack.ErrTransactionNotFound):
		return false
	default:
		return true
	}
}