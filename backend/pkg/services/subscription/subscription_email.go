// backend/pkg/services/subscription/subscription_email.go

package subscription

import (
	"context"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/repository/subscription"
	"github.com/eventify/backend/pkg/utils"
	"github.com/rs/zerolog/log"
)

// sendPaymentSuccessEmails sends payment confirmation emails
func (s *subscriptionServiceImpl) sendPaymentSuccessEmails(ctx context.Context) error {
	recipients, err := s.subscriptionRepo.GetNeedingPaymentEmail(ctx)
	if err != nil {
		return err
	}

	if len(recipients) == 0 {
		return nil
	}

	successCount := 0
	for _, r := range recipients {
		subject := fmt.Sprintf("Payment Successful - Welcome to %s Plan!", capitalize(r.Tier))
		body := buildPaymentSuccessEmail(r)

		if err := utils.MockSendEmail(r.UserEmail, subject, body); err != nil {
			log.Error().Err(err).Str("email", r.UserEmail).Msg("Failed to send payment email")
			continue
		}

		// Mark as sent
		now := time.Now()
		if err := s.subscriptionRepo.UpdateEmailTracking(ctx, subscription.EmailTrackingParams{
			SubscriptionID:       r.SubscriptionID,
			PaymentSuccessSentAt: &now,
		}); err != nil {
			log.Error().Err(err).Msg("Failed to mark payment email sent")
			continue
		}

		successCount++
	}

	log.Info().Int("sent", successCount).Int("total", len(recipients)).Msg("Payment emails sent")
	return nil
}

// sendReminderEmails sends all reminder types
func (s *subscriptionServiceImpl) sendReminderEmails(ctx context.Context) error {
	s.sendReminderType(ctx, "7d")
	s.sendReminderType(ctx, "3d")
	s.sendReminderType(ctx, "1d")
	return nil
}

// sendReminderType sends reminders for a specific day count
func (s *subscriptionServiceImpl) sendReminderType(ctx context.Context, reminderType string) {
	var recipients []subscription.EmailRecipient
	var err error

	switch reminderType {
	case "7d":
		recipients, err = s.subscriptionRepo.GetNeedingReminder7D(ctx)
	case "3d":
		recipients, err = s.subscriptionRepo.GetNeedingReminder3D(ctx)
	case "1d":
		recipients, err = s.subscriptionRepo.GetNeedingReminder1D(ctx)
	}

	if err != nil || len(recipients) == 0 {
		return
	}

	for _, r := range recipients {
		subject := fmt.Sprintf("Your %s Subscription Expires Soon", capitalize(r.Tier))
		body := buildReminderEmail(r, reminderType)

		if err := utils.MockSendEmail(r.UserEmail, subject, body); err != nil {
			continue
		}

		// Mark as sent
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

		s.subscriptionRepo.UpdateEmailTracking(ctx, params)
	}
}

// sendExpiredNotices sends expired subscription notices
func (s *subscriptionServiceImpl) sendExpiredNotices(ctx context.Context) error {
	recipients, err := s.subscriptionRepo.GetNeedingExpiredNotice(ctx)
	if err != nil || len(recipients) == 0 {
		return err
	}

	for _, r := range recipients {
		subject := fmt.Sprintf("Your %s Subscription Has Expired", capitalize(r.Tier))
		body := buildExpiredNoticeEmail(r)

		if err := utils.MockSendEmail(r.UserEmail, subject, body); err != nil {
			continue
		}

		now := time.Now()
		s.subscriptionRepo.UpdateEmailTracking(ctx, subscription.EmailTrackingParams{
			SubscriptionID:      r.SubscriptionID,
			ExpiredNoticeSentAt: &now,
		})
	}

	return nil
}

// Helper functions for email templates
func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return string(s[0]-32) + s[1:]
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
	days := map[string]string{"7d": "7 days", "3d": "3 days", "1d": "1 day"}[reminderType]
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