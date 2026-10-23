// backend/pkg/models/subscription.go
package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Tier & Status enums
// ---------------------------------------------------------------------------

type SubscriptionTier string

const (
	TierFree     SubscriptionTier = "free"
	TierBasic    SubscriptionTier = "basic"
	TierPremium  SubscriptionTier = "premium"
	TierFeatured SubscriptionTier = "featured"
)

// allowedTransitions defines valid status changes to prevent invalid state transitions
var allowedTransitions = map[SubscriptionStatus][]SubscriptionStatus{
	SubStatusPending:   {SubStatusActive, SubStatusCancelled},
	SubStatusActive:    {SubStatusExpired, SubStatusCancelled},
	SubStatusExpired:   {SubStatusActive},
	SubStatusCancelled: {},
}

// CanTransitionTo validates if a subscription can move to the target status
func (s *Subscription) CanTransitionTo(newStatus SubscriptionStatus) bool {
	allowed, exists := allowedTransitions[s.Status]
	if !exists {
		return false
	}
	for _, a := range allowed {
		if a == newStatus {
			return true
		}
	}
	return false
}

type SubscriptionStatus string

const (
	SubStatusActive    SubscriptionStatus = "active"
	SubStatusExpired   SubscriptionStatus = "expired"
	SubStatusCancelled SubscriptionStatus = "cancelled" 
	SubStatusPending   SubscriptionStatus = "pending"
)

// InitiateSubRequest is the payload from frontend to start a subscription
type InitiateSubRequest struct {
	Tier   SubscriptionTier `json:"tier" binding:"required"`
	Email  string           `json:"email"`
	AutoRenew bool          `json:"autoRenew"`
}

// PaystackResponse represents the response from Paystack's initialize endpoint
type PaystackResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

// ---------------------------------------------------------------------------
// Tier ordinal ranking — lets us do simple tier comparisons
// ---------------------------------------------------------------------------

var tierOrder = map[SubscriptionTier]int{
	TierFree:     0,
	TierBasic:    1,
	TierPremium:  2,
	TierFeatured: 3,
}

// Rank returns the ordinal value of a tier.
func (t SubscriptionTier) Rank() int {
	if r, ok := tierOrder[t]; ok {
		return r
	}
	return 0
}

// ---------------------------------------------------------------------------
// Subscription Features
// ---------------------------------------------------------------------------

type SubscriptionFeatures struct {
	EnhancedProfile       bool `json:"enhancedProfile"`
	BasicAnalytics        bool `json:"basicAnalytics"`
	RecentInquiries       bool `json:"recentInquiries"`
	PriorityListing       bool `json:"priorityListing"`
	DetailedAnalytics     bool `json:"detailedAnalytics"`
	RecentReviews         bool `json:"recentReviews"`
	DirectMessagePriority bool `json:"directMessagePriority"`
	VerifiedBadge         bool `json:"verifiedBadge"`
	FeaturedPlacement     bool `json:"featuredPlacement"`
	GoldBadge             bool `json:"goldBadge"`
	CategoryBoost         bool `json:"categoryBoost"`
	HomepageRotation      bool `json:"homepageRotation"`
}

var tierFeatures = map[SubscriptionTier]SubscriptionFeatures{
	TierFree: {},
	TierBasic: {
		EnhancedProfile: true,
		BasicAnalytics:  true,
		RecentInquiries: true,
	},
	TierPremium: {
		EnhancedProfile:       true,
		BasicAnalytics:        true,
		RecentInquiries:       true,
		PriorityListing:       true,
		DetailedAnalytics:     true,
		RecentReviews:         true,
		DirectMessagePriority: true,
		VerifiedBadge:         true,
	},
	TierFeatured: {
		EnhancedProfile:       true,
		BasicAnalytics:        true,
		RecentInquiries:       true,
		PriorityListing:       true,
		DetailedAnalytics:     true,
		RecentReviews:         true,
		DirectMessagePriority: true,
		VerifiedBadge:         true,
		FeaturedPlacement:     true,
		GoldBadge:             true,
		CategoryBoost:         true,
		HomepageRotation:      true,
	},
}

func GetFeatures(tier SubscriptionTier) SubscriptionFeatures {
	if f, ok := tierFeatures[tier]; ok {
		return f
	}
	return tierFeatures[TierFree]
}

// ---------------------------------------------------------------------------
// Tier pricing (in Kobo)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Tier pricing: single source of truth (kobo)
// ---------------------------------------------------------------------------

// monthlyPriceKobo is the one authoritative monthly price per paid tier.
// Amounts sent to Paystack and amounts shown to users both derive from here.
var monthlyPriceKobo = map[SubscriptionTier]int64{
	TierBasic:    350_000,   // ₦3,500
	TierPremium:  1_000_000, // ₦10,000
	TierFeatured: 2_500_000, // ₦25,000
}

// PriceKobo returns the monthly price of a paid tier. ok is false for the
// free tier and for unknown tiers, which can never be purchased.
func PriceKobo(tier SubscriptionTier) (kobo int64, ok bool) {
	kobo, ok = monthlyPriceKobo[tier]
	return kobo, ok
}

// PaidTiers lists purchasable tiers, cheapest first.
func PaidTiers() []SubscriptionTier {
	return []SubscriptionTier{TierBasic, TierPremium, TierFeatured}
}

// Plan is the public, display-ready description of a purchasable tier.
type Plan struct {
	Tier         SubscriptionTier     `json:"tier"`
	PriceKobo    int64                `json:"priceKobo"`
	Currency     string               `json:"currency"`
	BillingCycle string               `json:"billingCycle"`
	Features     SubscriptionFeatures `json:"features"`
}

// GetPlans returns every purchasable plan, cheapest first.
func GetPlans() []Plan {
	tiers := PaidTiers()
	plans := make([]Plan, 0, len(tiers))
	for _, t := range tiers {
		price, _ := PriceKobo(t)
		plans = append(plans, Plan{
			Tier: t, PriceKobo: price, Currency: "NGN",
			BillingCycle: "month", Features: GetFeatures(t),
		})
	}
	return plans
}

// Deprecated: use PriceKobo. Remove once no callers remain.
type TierPricing struct {
	MinKobo int64 `json:"minKobo"`
	MaxKobo int64 `json:"maxKobo"`
}

// Deprecated: use PriceKobo.
func GetPricing(tier SubscriptionTier) TierPricing {
	p, _ := PriceKobo(tier)
	return TierPricing{MinKobo: p, MaxKobo: p}
}

// ---------------------------------------------------------------------------
// Subscription model
// ---------------------------------------------------------------------------

type Subscription struct {
    ID                uuid.UUID          `json:"id" db:"id"`
    VendorID          uuid.UUID          `json:"vendorId" db:"vendor_id"`
    Tier              SubscriptionTier   `json:"tier" db:"tier"`
    Status            SubscriptionStatus `json:"status" db:"status"`
    StartsAt          time.Time          `json:"startsAt" db:"starts_at"`
    ExpiresAt         sql.NullTime       `json:"expiresAt" db:"expires_at"`
    AutoRenew         bool               `json:"autoRenew" db:"auto_renew"`
    Price             int64              `json:"price" db:"price"`
    Currency          string             `json:"currency" db:"currency"`
    PaymentReference  sql.NullString     `json:"paymentReference" db:"payment_reference"`
    PaymentMethod     sql.NullString     `json:"paymentMethod" db:"payment_method"`
    LastPaymentDate   sql.NullTime       `json:"lastPaymentDate" db:"last_payment_date"`
    NextPaymentDate   sql.NullTime       `json:"nextPaymentDate" db:"next_payment_date"`

    WebhookAttempts   int                `json:"webhookAttempts" db:"webhook_attempts"`
    
    CreatedAt         time.Time          `json:"createdAt" db:"created_at"`
    UpdatedAt         time.Time          `json:"updatedAt" db:"updated_at"`

    PaymentSuccessSentAt sql.NullTime   `json:"-" db:"payment_success_sent_at"`
    Reminder7DSentAt     sql.NullTime   `json:"-" db:"reminder_7d_sent_at"`
    Reminder3DSentAt     sql.NullTime   `json:"-" db:"reminder_3d_sent_at"`
    Reminder1DSentAt     sql.NullTime   `json:"-" db:"reminder_1d_sent_at"`
    ExpiredNoticeSentAt  sql.NullTime   `json:"-" db:"expired_notice_sent_at"`
}

func (s Subscription) MarshalJSON() ([]byte, error) {
	type Alias Subscription

	cleanStr := func(ns sql.NullString) interface{} {
		if ns.Valid {
			return ns.String
		}
		return nil
	}
	cleanTime := func(nt sql.NullTime) interface{} {
		if nt.Valid {
			return nt.Time.Format(time.RFC3339)
		}
		return nil
	}

	return json.Marshal(&struct {
		ExpiresAt        interface{} `json:"expiresAt"`
		PaymentReference interface{} `json:"paymentReference"`
		PaymentMethod    interface{} `json:"paymentMethod"`
		LastPaymentDate  interface{} `json:"lastPaymentDate"`
		NextPaymentDate  interface{} `json:"nextPaymentDate"`
		Alias
	}{
		ExpiresAt:        cleanTime(s.ExpiresAt),
		PaymentReference: cleanStr(s.PaymentReference),
		PaymentMethod:    cleanStr(s.PaymentMethod),
		LastPaymentDate:  cleanTime(s.LastPaymentDate),
		NextPaymentDate:  cleanTime(s.NextPaymentDate),
		Alias:            (Alias)(s),
	})
}

// ---------------------------------------------------------------------------
// Joined response structs
// ---------------------------------------------------------------------------

type VendorWithSubscription struct {
	Vendor       Vendor               `json:"vendor"`
	Subscription *Subscription        `json:"subscription,omitempty"`
	Features     SubscriptionFeatures `json:"features"`
	IsFeatured   bool                 `json:"isFeatured"`
	BadgeColor   string               `json:"badgeColor,omitempty"`
}


func (v *VendorWithSubscription) ResolveBadgeColor() string {
    // 1. Changed SubscriptionActive -> SubStatusActive to match your const
    if v.Subscription == nil || v.Subscription.Status != SubStatusActive {
        return ""
    }

    switch v.Subscription.Tier {
    case TierFeatured:
        return "gold"
    case TierPremium:
        return "silver"
    case TierBasic:
        return "bronze"
    default:
        return ""
    }
}