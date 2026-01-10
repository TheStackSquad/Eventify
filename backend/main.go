// backend/main.go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Core packages
	"eventify/backend/pkg/analytics"
	"eventify/backend/pkg/db"
	"eventify/backend/pkg/routes"

	// Repositories (aliased)
	repoauth "eventify/backend/pkg/repository/auth"
	repoevent "eventify/backend/pkg/repository/event"
	repofeedback "eventify/backend/pkg/repository/feedback"
	repoinquiries "eventify/backend/pkg/repository/inquiries"
	repolike "eventify/backend/pkg/repository/like"
	repoorder "eventify/backend/pkg/repository/order"
	reporeview "eventify/backend/pkg/repository/review"
	repovendor "eventify/backend/pkg/repository/vendor"

	// Services (aliased)
	serviceanalytics "eventify/backend/pkg/services/analytics"
	serviceevent "eventify/backend/pkg/services/event"
	servicefeedback "eventify/backend/pkg/services/feedback"
	serviceinquiries "eventify/backend/pkg/services/inquiries"
	servicejwt "eventify/backend/pkg/services/jwt"
	servicelike "eventify/backend/pkg/services/like"
	serviceorder "eventify/backend/pkg/services/order"
	servicepricing "eventify/backend/pkg/services/pricing"
	servicereview "eventify/backend/pkg/services/review"
	servicevendor "eventify/backend/pkg/services/vendor"

	// Handlers (aliased)
	handleranalytics "eventify/backend/pkg/handlers/analytics"
	handlerauth "eventify/backend/pkg/handlers/auth"
	handlerevent "eventify/backend/pkg/handlers/event"
	handlerfeedback "eventify/backend/pkg/handlers/feedback"
	handlerinquiries "eventify/backend/pkg/handlers/inquiries"
	handlerorder "eventify/backend/pkg/handlers/order"
	handlerreview "eventify/backend/pkg/handlers/review"
	handlervendor "eventify/backend/pkg/handlers/vendor"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// startTokenCleanup schedules periodic cleanup of expired refresh tokens
func startTokenCleanup(repo repoauth.RefreshTokenRepository) {
	ticker := time.NewTicker(24 * time.Hour)
	
	// Initial cleanup
	go func() {
		ctx := context.Background()
		deleted, err := repo.CleanupExpiredTokens(ctx)
		if err != nil {
			log.Error().Err(err).Msg("Failed initial token cleanup")
		} else {
			log.Info().Int64("count", deleted).Msg("Initial token cleanup completed")
		}
	}()

	// Periodic cleanup
	go func() {
		for range ticker.C {
			ctx := context.Background()
			deleted, err := repo.CleanupExpiredTokens(ctx)
			if err != nil {
				log.Error().Err(err).Msg("Failed scheduled token cleanup")
			} else {
				log.Info().Int64("count", deleted).Msg("Scheduled token cleanup completed")
			}
		}
	}()

	log.Info().Msg("Token cleanup scheduler started (24-hour intervals)")
}

func main() {
	// Logger setup
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
	}).With().Timestamp().Logger()

	// Gin mode configuration
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Database initialization
	db.ConnectDB()
	log.Info().Msg("Database connection established")
	defer db.CloseDB()

	dbClient := db.GetDB()

	// Repository initialization
	vendorRepo := repovendor.NewPostgresVendorRepository(dbClient)
	authRepo := repoauth.NewPostgresAuthRepository(dbClient)
	refreshTokenRepo := repoauth.NewPostgresRefreshTokenRepository(dbClient)
	likeRepo := repolike.NewPostgresLikeRepository(dbClient)
	reviewRepo := reporeview.NewPostgresReviewRepository(dbClient)
	inquiryRepo := repoinquiries.NewInquiryRepository(dbClient)
	feedbackRepo := repofeedback.NewFeedbackRepository(dbClient)
	orderRepo := repoorder.NewPostgresOrderRepository(dbClient)
	eventRepo := repoevent.NewPostgresEventRepository(dbClient)

	analyticsRepo := analytics.NewPostgresAnalyticsRepository(dbClient)
	vendorCoreMetricsRepo := repovendor.NewVendorCoreMetricsRepository(dbClient)
	vendorMetricsRepo := repovendor.NewVendorMetricsRepository(dbClient)
	vendorDataRepo := repovendor.NewVendorDataRepository(dbClient)

	// Service initialization
	eventService := serviceevent.NewEventService(dbClient, eventRepo)
	likeService := servicelike.NewLikeService(likeRepo)
	vendorService := servicevendor.NewVendorService(vendorRepo)
	reviewService := servicereview.NewReviewService(reviewRepo, vendorRepo, inquiryRepo)
	inquiryService := serviceinquiries.NewInquiryService(inquiryRepo, inquiryRepo, vendorRepo)
	feedbackService := servicefeedback.NewFeedbackService(feedbackRepo)
	analyticsService := serviceanalytics.NewAnalyticsService(analyticsRepo)
	vendorAnalyticsService := servicevendor.NewVendorAnalyticsService(
		vendorCoreMetricsRepo,
		vendorMetricsRepo,
		vendorDataRepo,
	)

	paystackClient := &serviceorder.PaystackClientImpl{
		SecretKey:  os.Getenv("PAYSTACK_SECRET_KEY"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}

	pricingService := servicepricing.NewPricingService(eventRepo)
	orderService := serviceorder.NewOrderService(
		orderRepo,
		eventRepo,
		pricingService,
		paystackClient,
	)
	jwtService := servicejwt.NewJWTService()

	// Handler initialization
	authHandler := handlerauth.NewAuthHandler(authRepo, refreshTokenRepo, jwtService)
	eventHandler := handlerevent.NewEventHandler(eventService, likeService)
	vendorHandler := handlervendor.NewVendorHandler(vendorService)
	reviewHandler := handlerreview.NewReviewHandler(reviewService)
	inquiryHandler := handlerinquiries.NewInquiryHandler(inquiryService)
	feedbackHandler := handlerfeedback.NewFeedbackHandler(feedbackService)
	orderHandler := handlerorder.NewOrderHandler(orderService)
	analyticsHandler := handleranalytics.NewAnalyticsHandler(analyticsService)
	vendorAnalyticsHandler := handlervendor.NewVendorAnalyticsHandler(vendorAnalyticsService)

	// Start token cleanup scheduler
	startTokenCleanup(refreshTokenRepo)

	// Router configuration
	router := routes.ConfigureRouter(
		authHandler,
		eventHandler,
		vendorHandler,
		reviewHandler,
		inquiryHandler,
		feedbackHandler,
		orderHandler,
		authRepo,
		analyticsHandler,
		vendorAnalyticsHandler,
	)

	// Server configuration
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	serverAddr := fmt.Sprintf(":%s", port)

	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	go func() {
		log.Info().
			Str("service", "eventify-api").
			Str("addr", serverAddr).
			Msgf("Server starting on %s", serverAddr)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().
				Err(err).
				Str("addr", serverAddr).
				Msg("Server failed to start")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Warn().Msg("Server shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server stopped gracefully")
}