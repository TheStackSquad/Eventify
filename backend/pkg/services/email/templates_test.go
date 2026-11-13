// backend/pkg/services/email/templates_test.go

package email

import (
	"strings"
	"testing"
)

var subTemplates = []string{TplSubPaymentSuccess, TplSubReminder7D, TplSubReminder3D, TplSubReminder1D, TplSubExpired}

func samplePayload() SubscriptionPayload {
	return SubscriptionPayload{UserName: "Ada", VendorName: "Mama Titi", Tier: "premium", PriceKobo: 700000, ExpiresAt: "2026-11-20T10:00:00Z"}
}

func renderFor(t *testing.T, tpl string) (subject, body string) {
	t.Helper()
	subject, payload, _, err := BuildSubscriptionEmail(tpl, "sub-1", samplePayload())
	if err != nil {
		t.Fatalf("%s: build: %v", tpl, err)
	}
	_, body, err = render(outboxRow{TemplateType: tpl, Subject: subject, Payload: payload})
	if err != nil {
		t.Fatalf("%s: render: %v", tpl, err)
	}
	return subject, body
}

func TestSubscriptionTemplatesContent(t *testing.T) {
	t.Setenv("FRONTEND_BASE_URL", "https://app.example.test")
	for _, tpl := range subTemplates {
		subject, body := renderFor(t, tpl)
		if subject == "" {
			t.Errorf("%s: empty subject", tpl)
		}
		for _, want := range []string{"Ada", "Premium", "₦7,000.00", "https://app.example.test"} {
			if !strings.Contains(body, want) {
				t.Errorf("%s: body is missing %q", tpl, want)
			}
		}
		if strings.Contains(body, "eventify.ng") {
			t.Errorf("%s: body links to a domain we do not control", tpl)
		}
	}
}

func TestSubscriptionTemplatesWithoutSiteURL(t *testing.T) {
	t.Setenv("FRONTEND_BASE_URL", "")
	t.Setenv("FRONTEND_URL", "")
	for _, tpl := range subTemplates {
		if _, body := renderFor(t, tpl); strings.Contains(body, "http") {
			t.Errorf("%s: must not print links when FRONTEND_BASE_URL is unset", tpl)
		}
	}
}

func TestSubscriptionDedupeKeys(t *testing.T) {
	seen := map[string]string{}
	for _, tpl := range subTemplates {
		_, _, key, err := BuildSubscriptionEmail(tpl, "sub-1", samplePayload())
		if err != nil {
			t.Fatal(err)
		}
		if prev, dup := seen[key]; dup {
			t.Errorf("%s and %s share the key %q", tpl, prev, key)
		}
		seen[key] = tpl
	}
	renewed := samplePayload()
	renewed.ExpiresAt = "2026-12-20T10:00:00Z"
	_, _, k1, _ := BuildSubscriptionEmail(TplSubReminder7D, "sub-1", samplePayload())
	_, _, k2, _ := BuildSubscriptionEmail(TplSubReminder7D, "sub-1", renewed)
	if k1 == k2 {
		t.Error("a renewal (new expiry date) must start a fresh reminder")
	}
	_, _, p1, _ := BuildSubscriptionEmail(TplSubPaymentSuccess, "sub-1", samplePayload())
	_, _, p2, _ := BuildSubscriptionEmail(TplSubPaymentSuccess, "sub-1", renewed)
	if p1 != p2 {
		t.Error("the payment confirmation must be sent once per subscription")
	}
}

func TestUnknownTemplateIsPermanent(t *testing.T) {
	if _, _, err := render(outboxRow{TemplateType: "NOPE", Payload: "{}"}); err == nil || !isPermanent(err) {
		t.Fatalf("expected a permanent error, got %v", err)
	}
	if _, _, _, err := BuildSubscriptionEmail("NOPE", "x", samplePayload()); err == nil {
		t.Fatal("expected an error for an unknown subscription template")
	}
}

func TestFormatNaira(t *testing.T) {
	for in, want := range map[int64]string{700000: "₦7,000.00", 123456789: "₦1,234,567.89", 5: "₦0.05", 0: "₦0.00"} {
		if got := formatNaira(in); got != want {
			t.Errorf("formatNaira(%d) = %q, want %q", in, got, want)
		}
	}
}