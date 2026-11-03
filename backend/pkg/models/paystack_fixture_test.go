// backend/pkg/models/paystack_fixture_test.go

package models

import (
	"encoding/json"
	"os"
	"testing"
)

func loadChargeFixture(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/paystack_charge_success.json")
	if err != nil {
		t.Fatalf("fixture: %v", err)
	}
	return b
}

// A real charge.success webhook must parse. Its data.source is an object, which once broke parsing
// and made the backend acknowledge a paid payment it never applied.
func TestRealChargeSuccessWebhookParses(t *testing.T) {
	var w PaystackWebhook
	if err := json.Unmarshal(loadChargeFixture(t), &w); err != nil {
		t.Fatalf("real webhook did not parse: %v", err)
	}
	if w.Event != "charge.success" || w.Data == nil {
		t.Fatalf("unexpected event or empty data: %+v", w)
	}
	if w.Data.Status != "success" || w.Data.Amount != 1000000 || w.Data.Currency != "NGN" {
		t.Fatalf("wrong core fields: status=%q amount=%d currency=%q", w.Data.Status, w.Data.Amount, w.Data.Currency)
	}
	md, ok := w.Data.Metadata.(map[string]interface{})
	if !ok || md["payment_type"] != "subscription" || md["vendor_id"] == nil {
		t.Fatalf("metadata must decode as an object with payment_type and vendor_id: %#v", w.Data.Metadata)
	}
}

// Paystack changes optional fields over time. None of these variants may stop a payment being processed.
func TestWebhookToleratesPayloadVariants(t *testing.T) {
	variants := map[string]func(d map[string]interface{}){
		"source is a string":    func(d map[string]interface{}) { d["source"] = "api" },
		"source is null":        func(d map[string]interface{}) { d["source"] = nil },
		"metadata is null":      func(d map[string]interface{}) { d["metadata"] = nil },
		"metadata is a string":  func(d map[string]interface{}) { d["metadata"] = "{}" },
		"plan is a string":      func(d map[string]interface{}) { d["plan"] = "PLN_x" },
		"fees is null":          func(d map[string]interface{}) { d["fees"] = nil },
		"authorization is null": func(d map[string]interface{}) { d["authorization"] = nil },
		"customer is null":      func(d map[string]interface{}) { d["customer"] = nil },
		"an unknown field":      func(d map[string]interface{}) { d["brand_new_field"] = map[string]interface{}{"a": 1} },
	}
	for name, mutate := range variants {
		t.Run(name, func(t *testing.T) {
			var m map[string]interface{}
			if err := json.Unmarshal(loadChargeFixture(t), &m); err != nil {
				t.Fatal(err)
			}
			mutate(m["data"].(map[string]interface{}))
			b, _ := json.Marshal(m)
			var w PaystackWebhook
			if err := json.Unmarshal(b, &w); err != nil {
				t.Fatalf("variant %q must still parse: %v", name, err)
			}
		})
	}
}

func TestEveryRealWebhookFixtureParses(t *testing.T) {
	for _, name := range []string{"paystack_charge_success.json", "paystack_charge_success_bank_transfer.json"} {
		b, err := os.ReadFile("testdata/" + name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		var w PaystackWebhook
		if err := json.Unmarshal(b, &w); err != nil || w.Data == nil {
			t.Errorf("%s did not parse: %v", name, err)
		}
	}
}