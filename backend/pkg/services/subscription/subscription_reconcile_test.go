//backend/pkg/services/subscription/subscription_reconcile_test.go


package subscription

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestIsRetryable(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"bad signature", ErrInvalidSignature, false},
		{"malformed payload", fmt.Errorf("%w: x", ErrBadWebhookPayload), false},
		{"payment not successful", ErrPaymentNotSuccessful, false},
		{"held for review", ErrPaymentNeedsReview, false},
		{"unknown reference", fmt.Errorf("paystack verify: %w", paystack.ErrTransactionNotFound), false},
		{"gateway down", fmt.Errorf("paystack verify: %w", paystack.ErrUnavailable), true},
		{"gateway rejected our key", fmt.Errorf("x: %w", paystack.ErrRejected), true},
		{"database error", errors.New("pq: connection refused"), true},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, IsRetryable(tc.err), tc.name)
	}
}

func paidResponse(vendorID uuid.UUID) *models.PaystackVerificationResponse {
	return &models.PaystackVerificationResponse{
		Status:  true,
		Message: "Verification successful",
		Data: &models.PaystackData{
			Status:    "success",
			Reference: "ref-paid",
			Metadata: map[string]interface{}{
				"vendor_id": vendorID.String(),
			},
		},
	}
}

func TestReconcile_SettlesPaid_IgnoresUnpaidAndUnknown(t *testing.T) {
	ps, sr := &mockPaystackClient{}, &mockSubRepo{}
	svc := buildService(ps, sr)
	vendorID := uuid.New()

	sr.On("ListInitiatedBetween", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return([]string{"ref-paid", "ref-unpaid", "ref-ghost"}, nil)
	sr.On("AbandonStalePayments", mock.Anything, mock.Anything).Return(int64(0), nil)

	ps.On("VerifyTransaction", mock.Anything, "ref-paid").Return(paidResponse(vendorID), nil)

	unpaid := paidResponse(vendorID)
	unpaid.Data.Status = "abandoned"
	ps.On("VerifyTransaction", mock.Anything, "ref-unpaid").Return(unpaid, nil)

	ps.On("VerifyTransaction", mock.Anything, "ref-ghost").Return((*models.PaystackVerificationResponse)(nil), paystack.ErrTransactionNotFound)

	sr.On("SettlePayment", mock.Anything, mock.Anything).Return(nil)

	assert.NoError(t, svc.reconcilePayments(context.Background()))
	sr.AssertNumberOfCalls(t, "AbandonStalePayments", 1)
}