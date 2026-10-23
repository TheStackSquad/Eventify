//backend/pkg/repository/subscription/queries_settle.go

package subscription

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// SettlePayment applies a Paystack-verified payment exactly once.
func (r *subscriptionRepository) SettlePayment(ctx context.Context, in SettleInput) (SettleOutcome, error) {
	var outcome SettleOutcome

	err := r.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		// 1. Lock the ledger row: a webhook and a verify call for the same
		//    reference queue here, and the loser sees 'applied'.
		var p models.SubscriptionPayment
		err := tx.GetContext(ctx, &p,
			`SELECT `+paymentColumns+` FROM subscription_payments WHERE reference = $1 FOR UPDATE`, in.Reference)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrPaymentNotFound
		}
		if err != nil {
			return err
		}
		switch p.Status {
		case models.PaymentApplied:
			outcome = SettleAlreadyApplied
			return nil
		case models.PaymentNeedsReview:
			outcome = SettleNeedsReview // manual resolution only
			return nil
		}

		// 2. What Paystack collected must equal what the server priced.
		if in.PaidAmountKobo != p.AmountKobo || in.PaidCurrency != p.Currency {
			outcome = SettleNeedsReview
			return flagForReview(ctx, tx, in, fmt.Sprintf("paid %d %s, expected %d %s",
				in.PaidAmountKobo, in.PaidCurrency, p.AmountKobo, p.Currency))
		}

		// 3. Serialise per vendor so two payments can't both create an active row.
		var lockedVendor uuid.UUID
		if err := tx.QueryRowContext(ctx, `SELECT id FROM vendors WHERE id = $1 FOR NO KEY UPDATE`, p.VendorID).Scan(&lockedVendor); err != nil {
			return fmt.Errorf("lock vendor: %w", err)
		}
		var active models.Subscription
		err = tx.GetContext(ctx, &active,
			`SELECT * FROM subscriptions WHERE vendor_id = $1 AND status = 'active' FOR UPDATE`, p.VendorID)
		hasActive := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		// 4. Lapsed but not yet swept: expire it here so a fresh row can be created.
		if hasActive && active.ExpiresAt.Valid && !active.ExpiresAt.Time.After(in.Now) {
			if _, err := tx.ExecContext(ctx, `UPDATE subscriptions SET status = 'expired' WHERE id = $1`, active.ID); err != nil {
				return err
			}
			hasActive = false
		}

		// 5. Initiate blocks tier switches; only a race can reach this.
		if hasActive && active.Tier != p.Tier {
			outcome = SettleNeedsReview
			return flagForReview(ctx, tx, in, fmt.Sprintf("paid %s while %s is active", p.Tier, active.Tier))
		}

		// 6. Renew the active row, or create the first one.
		var subID uuid.UUID
		if hasActive {
			subID = active.ID
			expiry := models.NextExpiry(in.Now, active.ExpiresAt.Time)
			_, err = tx.ExecContext(ctx, `
				UPDATE subscriptions
				SET payment_reference = $2, payment_method = $3, last_payment_date = $4,
				    expires_at = $5, next_payment_date = $5, price = $6
				WHERE id = $1`,
				subID, in.Reference, in.Channel, in.Now, expiry, p.AmountKobo)
		} else {
			subID = uuid.New()
			expiry := models.NextExpiry(in.Now, time.Time{})
			_, err = tx.ExecContext(ctx, `
				INSERT INTO subscriptions (id, vendor_id, tier, status, starts_at, expires_at, auto_renew,
					price, currency, payment_reference, payment_method, last_payment_date,
					next_payment_date, created_at, updated_at)
				VALUES ($1, $2, $3, 'active', $4, $5, false, $6, $7, $8, $9, $4, $5, $4, $4)`,
				subID, p.VendorID, p.Tier, in.Now, expiry, p.AmountKobo, p.Currency, in.Reference, in.Channel)
		}
		if err != nil {
			return err
		}

		// 7. Close the ledger row.
		_, err = tx.ExecContext(ctx, `
			UPDATE subscription_payments
			SET status = 'applied', subscription_id = $2, paid_amount_kobo = $3, paid_currency = $4,
			    channel = $5, paid_at = $6, applied_at = $7
			WHERE reference = $1`,
			in.Reference, subID, in.PaidAmountKobo, in.PaidCurrency, in.Channel, in.PaidAt, in.Now)
		outcome = SettleApplied
		return err
	})
	if err != nil {
		return "", err
	}
	return outcome, nil
}

// flagForReview records the anomaly and commits: the money was received, so
// the row must survive. Nothing else is touched.
func flagForReview(ctx context.Context, tx *sqlx.Tx, in SettleInput, reason string) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE subscription_payments
		SET status = 'needs_review', review_reason = $2, paid_amount_kobo = $3,
		    paid_currency = $4, channel = $5, paid_at = $6
		WHERE reference = $1`,
		in.Reference, reason, in.PaidAmountKobo, in.PaidCurrency, in.Channel, in.PaidAt)
	return err
}