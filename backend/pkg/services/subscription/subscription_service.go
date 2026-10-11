// backend/pkg/services/subscription/subscription_service.go

package subscription

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type subscriptionServiceImpl struct {
	vendorRepo       repovendor.VendorRepository
	subscriptionRepo reposub.SubscriptionRepository
	authRepo         repoauth.AuthRepository
	paystack         paystack.Client
	webhookSecret    string
}

// NewSubscriptionService creates a new instance of the subscription service
func NewSubscriptionService(vr repovendor.VendorRepository, sr reposub.SubscriptionRepository, ar repoauth.AuthRepository, pc paystack.Client, secret string) SubscriptionService {
	return &subscriptionServiceImpl{
		vendorRepo:       vr,
		subscriptionRepo: sr,
		authRepo:         ar,
		paystack:         pc,
		webhookSecret:    secret,
	}
}

// GetMySubscription retrieves current subscription status for a vendor
func (s *subscriptionServiceImpl) GetMySubscription(ctx context.Context, vendorID uuid.UUID) (*models.Subscription, error) {
	log.Debug().Str("vendorID", vendorID.String()).Msg("🔍 Fetching vendor subscription status")
	vendorWithSub, err := s.vendorRepo.GetVendorSubscription(ctx, vendorID)
	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID.String()).Msg("❌ Failed to fetch subscription")
		return nil, err
	}
	return vendorWithSub.Subscription, nil
}
