//backend/pkg/services/email/templates.go

package email

import (
	"encoding/json"
	"fmt"
	//"os"
	"strconv"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/utils"
	
)

// Template names understood by the worker. TICKET_DELIVERY is rendered in email_worker.go.
const (
	TplSubPaymentSuccess = "SUBSCRIPTION_PAYMENT_SUCCESS"
	TplSubReminder7D     = "SUBSCRIPTION_REMINDER_7D"
	TplSubReminder3D     = "SUBSCRIPTION_REMINDER_3D"
	TplSubReminder1D     = "SUBSCRIPTION_REMINDER_1D"
	TplSubExpired        = "SUBSCRIPTION_EXPIRED"
)

// SubscriptionPayload is the data the subscription templates need.
type SubscriptionPayload struct {
	UserName   string `json:"user_name"`
	VendorName string `json:"vendor_name"`
	Tier       string `json:"tier"`
	PriceKobo  int64  `json:"price_kobo"`
	ExpiresAt  string `json:"expires_at"` // RFC 3339
}

var lagos = time.FixedZone("WAT", 60*60) // Nigeria has no daylight saving

func isSubscriptionTemplate(t string) bool {
	switch t {
	case TplSubPaymentSuccess, TplSubReminder7D, TplSubReminder3D, TplSubReminder1D, TplSubExpired:
		return true
	}
	return false
}

// BuildSubscriptionEmail returns the subject, JSON payload and dedupe key for one subscription email.
// The dedupe key makes queueing idempotent. Reminders and expiry notices include the expiry date,
// so a renewal starts a fresh set; the payment confirmation is once per subscription.
func BuildSubscriptionEmail(template, subscriptionID string, p SubscriptionPayload) (subject, payloadJSON, dedupeKey string, err error) {
	if !isSubscriptionTemplate(template) {
		return "", "", "", fmt.Errorf("unknown subscription template %q", template)
	}
	b, err := json.Marshal(p)
	if err != nil {
		return "", "", "", err
	}
	key := "sub:" + template + ":" + subscriptionID
	if template != TplSubPaymentSuccess && len(p.ExpiresAt) >= 10 {
		key += ":" + p.ExpiresAt[:10]
	}
	return subscriptionSubject(template, p.Tier), string(b), key, nil
}

func subscriptionSubject(template, tier string) string {
	t := titleCase(tier)
	switch template {
	case TplSubPaymentSuccess:
		return fmt.Sprintf("Payment Successful - Welcome to %s Plan!", t)
	case TplSubExpired:
		return fmt.Sprintf("Your %s Subscription Has Expired", t)
	default:
		return fmt.Sprintf("Your %s Subscription Expires Soon", t)
	}
}

func titleCase(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func formatNaira(kobo int64) string {
	if kobo < 0 {
		kobo = 0
	}
	whole, frac := kobo/100, kobo%100
	digits := strconv.FormatInt(whole, 10)
	var b strings.Builder
	for i, c := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	return fmt.Sprintf("₦%s.%02d", b.String(), frac)
}

func formatExpiry(rfc3339 string, withTime bool) string {
	t, err := time.Parse(time.RFC3339, rfc3339)
	if err != nil {
		return "date unavailable"
	}
	t = t.In(lagos)
	if withTime {
		return t.Format("Jan 2 at 3:04PM")
	}
	return t.Format("Jan 2, 2006")
}

// siteLink returns "\nLabel: <url>\n", or "" when FRONTEND_BASE_URL is unset (no dead links).
func siteLink(label, path string) string {
	base, _ := utils.FrontendBaseURL()
	if base == "" {
		return ""
	}
	return fmt.Sprintf("\n%s: %s%s\n", label, base, path)
}

func renderSubscriptionBody(template string, p SubscriptionPayload) string {
	tier := titleCase(p.Tier)
	price := formatNaira(p.PriceKobo)
	renew := siteLink("Renew now", "/dashboard/subscription/renew")

	switch template {
	case TplSubPaymentSuccess:
		return fmt.Sprintf("Hello %s,\n\nThank you for subscribing to the Eventify %s plan!\n\nAmount paid: %s\nValid until: %s\n\nYour vendor profile \"%s\" now has premium access.\n%s\nBest regards,\nThe Eventify Team\n",
			p.UserName, tier, price, formatExpiry(p.ExpiresAt, false), p.VendorName,
			siteLink("Manage your subscription", "/dashboard/subscription"))
	case TplSubReminder7D, TplSubReminder3D, TplSubReminder1D:
		days := map[string]string{TplSubReminder7D: "7 days", TplSubReminder3D: "3 days", TplSubReminder1D: "1 day"}[template]
		footer := ""
		if prefs := siteLink("To manage email preferences, visit", "/account/settings"); prefs != "" {
			footer = "\n---" + prefs + "You will still receive important account notifications.\n"
		}
		return fmt.Sprintf("Hello %s,\n\nYour %s subscription expires in %s (%s).\n\nRenewal price: %s\n%s\nBest regards,\nThe Eventify Team\n%s",
			p.UserName, tier, days, formatExpiry(p.ExpiresAt, true), price, renew, footer)
	case TplSubExpired:
		return fmt.Sprintf("Hello %s,\n\nYour %s subscription has expired (%s).\n\nYour vendor profile has been moved to the Free tier.\n\nRenewal price: %s\n%s\nBest regards,\nThe Eventify Team\n",
			p.UserName, tier, formatExpiry(p.ExpiresAt, false), price, renew)
	}
	return ""
}