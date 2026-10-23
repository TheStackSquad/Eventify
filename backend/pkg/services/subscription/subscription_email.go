// backend/pkg/services/subscription/subscription_email.go

package subscription

import (
	"context"
	"fmt"
	"strings"
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
	subject, payload, key, err := serviceemail.BuildSubscriptionEmail(template, fmt.Sprint(r.SubscriptionID), serviceemail.SubscriptionPayload{
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


// Helper functions for email templates
func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func buildPaymentSuccessEmail(r subscription.EmailRecipient) string {
	priceNaira := float64(r.PriceKobo) / 100
	return fmt.Sprintf(`Hello %s,

Thank you for subscribing to Eventify %s Plan!

Amount Paid: ₦%.2f
Valid Until: %s

Your vendor profile "%s" now has premium access.

Manage subscription: https://eventify.ng/dashboard/subscription

Best regards,
The Eventify Team`, r.UserName, capitalize(r.Tier), priceNaira, r.ExpiresAt.Format("Jan 2, 2006"), r.VendorName)
}

func buildReminderEmail(r subscription.EmailRecipient, reminderType string) string {
	daysMap := map[string]string{"7d": "7 days", "3d": "3 days", "1d": "1 day"}
	days := daysMap[reminderType]
	priceNaira := float64(r.PriceKobo) / 100

	return fmt.Sprintf(`Hello %s,

Your %s subscription expires in %s (%s).

Renewal Price: ₦%.2f

Renew now: https://eventify.ng/dashboard/subscription/renew

Best regards,
The Eventify Team

---
To manage email preferences, visit: https://eventify.ng/account/settings
You will still receive important account notifications.`,
		r.UserName, capitalize(r.Tier), days, r.ExpiresAt.Format("Jan 2 at 3:04PM"),
		priceNaira)
}

func buildExpiredNoticeEmail(r subscription.EmailRecipient) string {
	priceNaira := float64(r.PriceKobo) / 100

	return fmt.Sprintf(`Hello %s,

Your %s subscription has expired (%s).

Your vendor profile has been moved to the Free tier.

Renew now: https://eventify.ng/dashboard/subscription/renew
Price: ₦%.2f

Best regards,
The Eventify Team`, r.UserName, capitalize(r.Tier), r.ExpiresAt.Format("Jan 2, 2006"), priceNaira)
}
