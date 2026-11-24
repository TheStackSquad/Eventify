// backend/pkg/handlers/vendor/verification_test.go
package vendor

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

const testSecret = "0123456789abcdef0123456789abcdef"

func setProofEnv(t *testing.T) {
	t.Helper()
	t.Setenv("VERIFICATION_PROOF_SECRET", testSecret)
	t.Setenv("ALLOW_SANDBOX_VERIFICATION", "")
}

// mint signs claims exactly like frontend/src/utils/server/verificationProof.js.
func mint(claims map[string]any) string {
	payload, _ := json.Marshal(claims)
	body := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(testSecret))
	mac.Write([]byte(body))
	return body + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func merge(base, over map[string]any) map[string]any {
	for k, v := range over {
		base[k] = v
	}
	return base
}

func vninProof(uid uuid.UUID, over map[string]any) string {
	return mint(merge(map[string]any{
		"v": 1, "kind": "vnin", "uid": uid.String(),
		"fn": "Ada", "mn": "Chioma", "ln": "Obi", "l4": "12CD",
		"env": "live", "exp": time.Now().Add(time.Hour).Unix(),
	}, over))
}

func cacProof(uid uuid.UUID, over map[string]any) string {
	return mint(merge(map[string]any{
		"v": 1, "kind": "cac", "uid": uid.String(),
		"rc": "RC1234567", "cn": "ADA FOODS LIMITED", "om": true,
		"env": "live", "exp": time.Now().Add(time.Hour).Unix(),
	}, over))
}

func newBinding(over func(*VendorBinding)) *VendorBinding {
	b := &VendorBinding{Name: "My Brand", Category: "caterer", State: "Lagos", FirstName: "Typed", LastName: "ByUser"}
	if over != nil {
		over(b)
	}
	return b
}

// ── verifyProof ──────────────────────────────────────────────────────────────

func TestVerifyProofAcceptsAValidProof(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	c, err := verifyProof(vninProof(uid, nil), "vnin", uid.String())
	if err != nil {
		t.Fatalf("valid proof rejected: %v", err)
	}
	if c.FirstName != "Ada" || c.LastName != "Obi" || c.Last4 != "12CD" {
		t.Fatalf("claims not read correctly: %+v", c)
	}
}

func TestVerifyProofRejects(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	good := vninProof(uid, nil)
	tampered := "X" + good[1:] // changes the signed payload, so the signature no longer matches

	cases := []struct{ name, token, kind, uid string }{
		{"tampered payload", tampered, "vnin", uid.String()},
		{"wrong kind", good, "cac", uid.String()},
		{"another user", good, "vnin", uuid.New().String()},
		{"expired", vninProof(uid, map[string]any{"exp": time.Now().Add(-time.Minute).Unix()}), "vnin", uid.String()},
		{"sandbox proof without the dev flag", vninProof(uid, map[string]any{"env": "sandbox"}), "vnin", uid.String()},
		{"empty token", "", "vnin", uid.String()},
		{"missing signature", "abc", "vnin", uid.String()},
		{"too many parts", good + ".x", "vnin", uid.String()},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := verifyProof(tc.token, tc.kind, tc.uid); err == nil {
				t.Fatal("expected the proof to be rejected")
			}
		})
	}
}

func TestSandboxProofsAreAcceptedOnlyWithTheDevFlag(t *testing.T) {
	setProofEnv(t)
	t.Setenv("ALLOW_SANDBOX_VERIFICATION", "true")
	uid := uuid.New()
	if _, err := verifyProof(vninProof(uid, map[string]any{"env": "sandbox"}), "vnin", uid.String()); err != nil {
		t.Fatalf("sandbox proof should pass with the dev flag: %v", err)
	}
}

func TestVerifyProofNeedsAConfiguredSecret(t *testing.T) {
	t.Setenv("VERIFICATION_PROOF_SECRET", "short")
	uid := uuid.New()
	_, err := verifyProof(vninProof(uid, nil), "vnin", uid.String())
	if !errors.Is(err, ErrProofSecretMissing) {
		t.Fatalf("want ErrProofSecretMissing, got %v", err)
	}
}

// ── applyVerification: identity ──────────────────────────────────────────────

func TestApplyRequiresAnIdentityProofOnCreate(t *testing.T) {
	setProofEnv(t)
	err := applyVerification(&models.Vendor{}, nil, newBinding(nil), uuid.New())
	if !errors.Is(err, ErrIdentityRequired) {
		t.Fatalf("want ErrIdentityRequired, got %v", err)
	}
}

func TestApplyTakesNamesFromTheProofNotTheForm(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	v := &models.Vendor{}
	b := newBinding(func(b *VendorBinding) { b.VNINProof = vninProof(uid, nil) })
	if err := applyVerification(v, nil, b, uid); err != nil {
		t.Fatal(err)
	}
	if !v.IsIdentityVerified || v.FirstName != "Ada" || v.LastName != "Obi" || v.MiddleName.String != "Chioma" {
		t.Fatalf("names must come from the proof: %+v", v)
	}
	if v.VNIN != "12CD" {
		t.Fatalf("only the last 4 characters may be kept, got %q", v.VNIN)
	}
}

func TestApplyRejectsAnotherUsersIdentityProof(t *testing.T) {
	setProofEnv(t)
	owner := uuid.New()
	b := newBinding(func(b *VendorBinding) { b.VNINProof = vninProof(uuid.New(), nil) })
	err := applyVerification(&models.Vendor{}, nil, b, owner)
	if !errors.Is(err, ErrIdentityProofBad) {
		t.Fatalf("want ErrIdentityProofBad, got %v", err)
	}
}

func TestVerifiedIdentityIsImmutable(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	current := &models.Vendor{IsIdentityVerified: true, FirstName: "Ada", LastName: "Obi", VNIN: "12CD"}
	v := &models.Vendor{}
	b := newBinding(func(b *VendorBinding) {
		b.FirstName, b.LastName = "Hacker", "Other"
		b.VNINProof = vninProof(uid, map[string]any{"fn": "Hacker", "ln": "Other", "l4": "9999"})
	})
	if err := applyVerification(v, current, b, uid); err != nil {
		t.Fatal(err)
	}
	if !v.IsIdentityVerified || v.FirstName != "Ada" || v.LastName != "Obi" || v.VNIN != "12CD" {
		t.Fatalf("verified identity must not change: %+v", v)
	}
}

func TestLegacyUnverifiedVendorKeepsTypedNamesAndStaysUnverified(t *testing.T) {
	setProofEnv(t)
	v := &models.Vendor{}
	if err := applyVerification(v, &models.Vendor{VNIN: "old"}, newBinding(nil), uuid.New()); err != nil {
		t.Fatal(err)
	}
	if v.IsIdentityVerified || v.FirstName != "Typed" || v.VNIN != "old" {
		t.Fatalf("unexpected result: %+v", v)
	}
}

// ── applyVerification: business ──────────────────────────────────────────────

func TestUnverifiedCACIsDroppedNotStored(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	v := &models.Vendor{Name: "My Brand"}
	b := newBinding(func(b *VendorBinding) { b.VNINProof = vninProof(uid, nil) })
	if err := applyVerification(v, nil, b, uid); err != nil {
		t.Fatal(err)
	}
	if v.CACNumber.Valid || v.IsBusinessVerified.Bool || v.IsBusinessRegistered || v.Name != "My Brand" {
		t.Fatalf("an unverified business must stay unverified and keep its typed name: %+v", v)
	}
}

func TestCACProofNeedsAVerifiedIdentity(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	b := newBinding(func(b *VendorBinding) { b.CACProof = cacProof(uid, nil) })
	err := applyVerification(&models.Vendor{}, &models.Vendor{}, b, uid) // legacy vendor, never verified
	if !errors.Is(err, ErrBusinessNeedsIdentity) {
		t.Fatalf("want ErrBusinessNeedsIdentity, got %v", err)
	}
}

func TestCACProofWithoutAnOwnerMatchIsRejected(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	b := newBinding(func(b *VendorBinding) {
		b.VNINProof = vninProof(uid, nil)
		b.CACProof = cacProof(uid, map[string]any{"om": false})
	})
	err := applyVerification(&models.Vendor{}, nil, b, uid)
	if !errors.Is(err, ErrBusinessProofBad) {
		t.Fatalf("want ErrBusinessProofBad, got %v", err)
	}
}

func TestVerifiedBusinessSetsNameAndCAC(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	v := &models.Vendor{Name: "My Brand"}
	b := newBinding(func(b *VendorBinding) {
		b.VNINProof = vninProof(uid, nil)
		b.CACProof = cacProof(uid, nil)
	})
	if err := applyVerification(v, nil, b, uid); err != nil {
		t.Fatal(err)
	}
	if v.Name != "ADA FOODS LIMITED" || v.CACNumber.String != "RC1234567" || !v.IsBusinessVerified.Bool || !v.IsBusinessRegistered {
		t.Fatalf("business not verified from the proof: %+v", v)
	}
	if v.FirstName != "Ada" {
		t.Fatalf("VNIN wins on personal names; the CAC proof must not touch them: %+v", v)
	}
}

func TestVerifiedBusinessIsImmutable(t *testing.T) {
	setProofEnv(t)
	uid := uuid.New()
	current := &models.Vendor{
		IsIdentityVerified: true, FirstName: "Ada", LastName: "Obi", VNIN: "12CD",
		Name:               "ADA FOODS LIMITED",
		CACNumber:          sql.NullString{String: "RC1234567", Valid: true},
		IsBusinessVerified: sql.NullBool{Bool: true, Valid: true},
	}
	v := &models.Vendor{}
	b := newBinding(func(b *VendorBinding) { b.Name = "Renamed Co" })
	if err := applyVerification(v, current, b, uid); err != nil {
		t.Fatal(err)
	}
	if v.Name != "ADA FOODS LIMITED" || v.CACNumber.String != "RC1234567" || !v.IsBusinessVerified.Bool {
		t.Fatalf("verified business must not change: %+v", v)
	}
}