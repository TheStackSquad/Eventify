// backend/pkg/handlers/vendor/verification.go
package vendor

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

var (
	ErrProofSecretMissing    = errors.New("verification proof secret is not configured")
	ErrIdentityRequired      = errors.New("identity verification is required")
	ErrIdentityProofBad      = errors.New("identity verification expired or invalid")
	ErrBusinessProofBad      = errors.New("business verification expired or invalid")
	ErrBusinessNeedsIdentity = errors.New("verify your identity before your business")
	errInvalidProof          = errors.New("invalid proof")
)

// proofClaims mirrors frontend/src/utils/server/verificationProof.js.
type proofClaims struct {
	V           int      `json:"v"`
	Kind        string   `json:"kind"`
	UID         string   `json:"uid"`
	FirstName   string   `json:"fn"`
	MiddleName  string   `json:"mn"`
	LastName    string   `json:"ln"`
	Last4       string   `json:"l4"`
	RC          string   `json:"rc"`
	CompanyName string   `json:"cn"`
	OwnerMatch  bool     `json:"om"`
	Roles       []string `json:"rl"`
	Env         string   `json:"env"`
	EXP         int64    `json:"exp"`
}

// verifyProof checks signature, expiry, kind and that the proof belongs to this user.
// Sandbox proofs are refused unless ALLOW_SANDBOX_VERIFICATION=true (dev only).
func verifyProof(token, kind, uid string) (*proofClaims, error) {
	secret := os.Getenv("VERIFICATION_PROOF_SECRET")
	if len(secret) < 32 {
		return nil, ErrProofSecretMissing
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errInvalidProof
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0]))
	given, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(mac.Sum(nil), given) {
		return nil, errInvalidProof
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errInvalidProof
	}
	var c proofClaims
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, errInvalidProof
	}
	if c.V != 1 || c.Kind != kind || !strings.EqualFold(c.UID, uid) || c.EXP < time.Now().Unix() {
		return nil, errInvalidProof
	}
	if c.Env == "sandbox" && os.Getenv("ALLOW_SANDBOX_VERIFICATION") != "true" {
		return nil, errInvalidProof
	}
	return &c, nil
}

// applyVerification decides every verification field from signed proofs ONLY.
// current is nil on create. Rules:
//   - verified identity / business are immutable
//   - VNIN wins for personal names; the CAC proof never touches them
//   - an unverified CAC is dropped, never stored (cac_number is shown publicly)
//   - only the last 4 characters of the vNIN are kept (NIMC: do not store it)
func applyVerification(v, current *models.Vendor, in *VendorBinding, ownerID uuid.UUID) error {
	uid := ownerID.String()

	// ── Identity ─────────────────────────────────────────────────────────────
	switch {
	case current != nil && current.IsIdentityVerified:
		v.IsIdentityVerified = true
		v.FirstName, v.MiddleName, v.LastName = current.FirstName, current.MiddleName, current.LastName
		v.VNIN = current.VNIN
	case in.VNINProof != "":
		c, err := verifyProof(in.VNINProof, "vnin", uid)
		if err != nil {
			if errors.Is(err, ErrProofSecretMissing) {
				return err
			}
			return ErrIdentityProofBad
		}
		v.IsIdentityVerified = true
		v.FirstName = c.FirstName
		v.MiddleName = models.ToNullString(c.MiddleName)
		v.LastName = c.LastName
		v.VNIN = c.Last4
	case current == nil:
		return ErrIdentityRequired
	default:
		// Legacy vendor that was never verified: typed names allowed, flag stays false.
		v.IsIdentityVerified = false
		v.FirstName = strings.TrimSpace(in.FirstName)
		v.MiddleName = models.ToNullString(strings.TrimSpace(in.MiddleName))
		v.LastName = strings.TrimSpace(in.LastName)
		v.VNIN = current.VNIN
	}

	// ── Business ─────────────────────────────────────────────────────────────
	switch {
	case current != nil && current.IsBusinessVerified.Valid && current.IsBusinessVerified.Bool:
		v.Name = current.Name
		v.CACNumber = current.CACNumber
		v.IsBusinessVerified = sql.NullBool{Bool: true, Valid: true}
	case in.CACProof != "":
		if !v.IsIdentityVerified {
			return ErrBusinessNeedsIdentity
		}
		c, err := verifyProof(in.CACProof, "cac", uid)
		if err != nil {
			if errors.Is(err, ErrProofSecretMissing) {
				return err
			}
			return ErrBusinessProofBad
		}
		if !c.OwnerMatch {
			return ErrBusinessProofBad
		}
		v.Name = c.CompanyName
		v.CACNumber = models.ToNullString(c.RC)
		v.IsBusinessVerified = sql.NullBool{Bool: true, Valid: true}
	default:
		v.CACNumber = sql.NullString{}
		v.IsBusinessVerified = sql.NullBool{Bool: false, Valid: true}
	}
	v.IsBusinessRegistered = v.IsBusinessVerified.Bool
	return nil
}