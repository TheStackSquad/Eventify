// backend/pkg/services/email/alert_template.go

package email

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// TplAdminAlert is the template name the email worker renders for money-attention alerts.
const TplAdminAlert = "ADMIN_ALERT"

// AlertPayload is stored in email_outbox.payload.
type AlertPayload struct {
	Kind      string `json:"kind"`
	Reference string `json:"reference"`
	Detail    string `json:"detail"`
	At        string `json:"at"` // RFC 3339, UTC
}

var alertKindRe = regexp.MustCompile(`^[a-z0-9_]{1,40}$`)

var alertLabels = map[string]string{
	"payment_held":   "a payment is held for review",
	"webhook_orphan": "a paid webhook matches no order or payment",
	"webhook_failed": "a webhook keeps failing",
}

var alertHints = map[string]string{
	"payment_held":   "A customer's payment was received and nothing was delivered. Decide: deliver what was bought, or refund it in the Paystack dashboard.",
	"webhook_orphan": "Paystack reported a payment this system does not know. It may belong to another environment, or an order may be missing.",
	"webhook_failed": "A signed webhook could not be processed and Paystack keeps retrying. The stored body can be replayed once the cause is fixed.",
}

func alertLabel(kind string) string {
	if l, ok := alertLabels[kind]; ok {
		return l
	}
	return strings.ReplaceAll(kind, "_", " ")
}

func oneLine(s string, max int) string {
	r := []rune(strings.Join(strings.Fields(s), " "))
	if len(r) > max {
		r = r[:max]
	}
	return string(r)
}

// BuildAlertEmail returns the subject, JSON payload and dedupe key for one alert. The key makes queueing idempotent:
// an item raises one alert, however many times it is seen.
func BuildAlertEmail(kind, reference, detail string) (subject, payloadJSON, dedupeKey string, err error) {
	if !alertKindRe.MatchString(kind) {
		return "", "", "", fmt.Errorf("alert kind %q must be 1 to 40 characters of a-z, 0-9 and _", kind)
	}
	ref := oneLine(reference, 100)
	b, err := json.Marshal(AlertPayload{Kind: kind, Reference: ref, Detail: oneLine(detail, 500), At: time.Now().UTC().Format(time.RFC3339)})
	if err != nil {
		return "", "", "", err
	}
	return "[Eventify] ACTION NEEDED: " + alertLabel(kind), string(b), "alert:" + kind + ":" + ref, nil
}

func renderAlertBody(p AlertPayload) string {
	when := p.At
	if t, err := time.Parse(time.RFC3339, p.At); err == nil {
		when = t.In(lagos).Format("Jan 2, 2006 at 3:04PM") + " (Lagos)"
	}
	hint, ok := alertHints[p.Kind]
	if !ok {
		hint = "Use the queries below to see the item."
	}
	return fmt.Sprintf("A person is needed.\n\nWhat: %s\nReference: %s\nWhen: %s\nDetail: %s\n\n%s\n\nWhere to look:\n  subscription payments: SELECT * FROM subscription_payments WHERE status = 'needs_review';\n  webhooks: SELECT * FROM webhook_inbox WHERE status IN ('orphan', 'failed') ORDER BY last_seen_at DESC;\n\nThis alert is sent once per item.\n",
		alertLabel(p.Kind), p.Reference, when, p.Detail, hint)
}