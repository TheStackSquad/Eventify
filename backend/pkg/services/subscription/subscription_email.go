// backend/pkg/services/subscription/subscription_email.go

package subscription

import (
	"context"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/repository/subscription"
	//"github.com/eventify/backend/pkg/utils"
	serviceemail "github.com/eventify/backend/pkg/services/email"
	"github.com/rs/zerolog/log"
)

// sendPaymentSuccessEmails sends payment confirmation emails
func (s *subscriptionServiceImpl) sendPaymentSuccessEmails(ctx context.Context) error {
	recipients, err := s.subscriptionRepo.GetNeedingPaymentEmail(ctx)
	if err != nil {
		return err
	}
	queued := 0
	for _, r := range recipients {
		if err := s.queueSubscriptionEmail(ctx, serviceemail.TplSubPaymentSuccess, r); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Msg("Failed to queue payment email")
			continue
		}
		now := time.Now()
		if err := s.subscriptionRepo.UpdateEmailTracking(ctx, subscription.EmailTrackingParams{
			SubscriptionID:       r.SubscriptionID,
			PaymentSuccessSentAt: &now,
		}); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Msg("Payment email queued but not marked; the next pass skips the duplicate")
			continue
		}
		queued++
	}
	if len(recipients) > 0 {
		log.Info().Int("queued", queued).Int("total", len(recipients)).Msg("Payment emails queued")
	}
	return nil
}

// sendReminderEmails sends all reminder types
func (s *subscriptionServiceImpl) sendReminderEmails(ctx context.Context) error {
	if err := s.sendReminderType(ctx, "7d"); err != nil {
		log.Error().Err(err).Msg("Failed to send 7d reminder emails")
	}
	if err := s.sendReminderType(ctx, "3d"); err != nil {
		log.Error().Err(err).Msg("Failed to send 3d reminder emails")
	}
	if err := s.sendReminderType(ctx, "1d"); err != nil {
		log.Error().Err(err).Msg("Failed to send 1d reminder emails")
	}
	return nil
}

// sendReminderType sends reminders for a specific day count
func (s *subscriptionServiceImpl) sendReminderType(ctx context.Context, reminderType string) error {
	var recipients []subscription.EmailRecipient
	var template string
	var err error

	switch reminderType {
	case "7d":
		template = serviceemail.TplSubReminder7D
		recipients, err = s.subscriptionRepo.GetNeedingReminder7D(ctx)
	case "3d":
		template = serviceemail.TplSubReminder3D
		recipients, err = s.subscriptionRepo.GetNeedingReminder3D(ctx)
	case "1d":
		template = serviceemail.TplSubReminder1D
		recipients, err = s.subscriptionRepo.GetNeedingReminder1D(ctx)
	default:
		return fmt.Errorf("unknown reminder type: %s", reminderType)
	}
	if err != nil {
		return err
	}

	for _, r := range recipients {
		if err := s.queueSubscriptionEmail(ctx, template, r); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Str("reminder_type", reminderType).Msg("Failed to queue reminder email")
			continue
		}
		now := time.Now()
		params := subscription.EmailTrackingParams{SubscriptionID: r.SubscriptionID}
		switch reminderType {
		case "7d":
			params.Reminder7DSentAt = &now
		case "3d":
			params.Reminder3DSentAt = &now
		case "1d":
			params.Reminder1DSentAt = &now
		}
		if err := s.subscriptionRepo.UpdateEmailTracking(ctx, params); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Str("reminder_type", reminderType).Msg("Reminder queued but not marked; the next pass skips the duplicate")
		}
	}
	return nil
}

// sendExpiredNotices sends expired subscription notices
func (s *subscriptionServiceImpl) sendExpiredNotices(ctx context.Context) error {
	recipients, err := s.subscriptionRepo.GetNeedingExpiredNotice(ctx)
	if err != nil {
		return err
	}
	for _, r := range recipients {
		if err := s.queueSubscriptionEmail(ctx, serviceemail.TplSubExpired, r); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Msg("Failed to queue expired notice")
			continue
		}
		now := time.Now()
		if err := s.subscriptionRepo.UpdateEmailTracking(ctx, subscription.EmailTrackingParams{
			SubscriptionID:      r.SubscriptionID,
			ExpiredNoticeSentAt: &now,
		}); err != nil {
			log.Error().Err(err).Str("subscription_id", fmt.Sprint(r.SubscriptionID)).Msg("Expired notice queued but not marked; the next pass skips the duplicate")
		}
	}
	return nil
}

// queueSubscriptionEmail hands one email to the outbox. Repeating it is harmless:
// the dedupe key turns a second call into a no-op.
func (s *subscriptionServiceImpl) queueSubscriptionEmail(ctx context.Context, template string, r subscription.EmailRecipient) error {
	// One email per plan per cycle: the expiry date moves with every paid month, so a renewal is a new cycle.
	cycle := fmt.Sprintf("%s:%s", r.SubscriptionID, r.ExpiresAt.UTC().Format("20060102"))
	subject, payload, key, err := serviceemail.BuildSubscriptionEmail(template, cycle, serviceemail.SubscriptionPayload{
		UserName:   r.UserName,
		VendorName: r.VendorName,
		Tier:       r.Tier,
		PriceKobo:  int64(r.PriceKobo),
		ExpiresAt:  r.ExpiresAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}
	return s.subscriptionRepo.QueueEmailOnce(ctx, r.UserEmail, subject, template, payload, key)
}

