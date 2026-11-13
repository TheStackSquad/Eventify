// backend/pkg/services/email/alert_test.go

package email

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildAlertEmail(t *testing.T) {
	subject, payload, key, err := BuildAlertEmail("payment_held", "ref-1", "paid 1000000,\n expected 1000100")
	if err != nil {
		t.Fatal(err)
	}
	if key != "alert:payment_held:ref-1" {
		t.Errorf("dedupe key = %q", key)
	}
	if !strings.Contains(subject, "ACTION NEEDED") {
		t.Errorf("subject = %q", subject)
	}
	var p AlertPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		t.Fatalf("payload is not JSON: %v", err)
	}
	if p.Reference != "ref-1" || strings.Contains(p.Detail, "\n") {
		t.Errorf("payload not normalised: %+v", p)
	}
}

func TestBuildAlertEmailRejectsBadKinds(t *testing.T) {
	for _, k := range []string{"", "Has Space", "a;drop", strings.Repeat("x", 41)} {
		if _, _, _, err := BuildAlertEmail(k, "r", "d"); err == nil {
			t.Errorf("kind %q should be rejected", k)
		}
	}
}

func TestRenderAlertBody(t *testing.T) {
	_, payload, _, _ := BuildAlertEmail("payment_held", "ref-1", "expected 1000100")
	var p AlertPayload
	_ = json.Unmarshal([]byte(payload), &p)
	body := renderAlertBody(p)
	for _, want := range []string{"ref-1", "expected 1000100", "Lagos", "refund"} {
		if !strings.Contains(body, want) {
			t.Errorf("body is missing %q", want)
		}
	}
}

// An alert must never be able to fail the work it is reporting on.
func TestQueueAdminAlertNeverFailsTheCaller(t *testing.T) {
	t.Setenv("ADMIN_ALERT_EMAIL", "")
	if err := QueueAdminAlert(context.Background(), nil, "needs_review", "ref-1", "detail"); err != nil {
		t.Fatalf("unset address: %v", err)
	}
	t.Setenv("ADMIN_ALERT_EMAIL", "ops@example.com")
	if err := QueueAdminAlert(context.Background(), nil, "payment_held", "ref-1", "detail"); err != nil {
		t.Fatalf("no database: %v", err)
	}
	if err := QueueAdminAlert(context.Background(), nil, "Bad Kind", "ref-1", "detail"); err != nil {
		t.Fatalf("bad kind: %v", err)
	}
}