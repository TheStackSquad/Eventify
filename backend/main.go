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
	"github.com/eventify/backend/pkg/analytics"
	"github.com/eventify/backend/pkg/db"
	"github.com/eventify/backend/pkg/routes"
	"github.com/eventify/backend/pkg/utils"

	// Repositories (aliased)
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	repofeedback "github.com/eventify/backend/pkg/repository/feedback"
	repoinquiries "github.com/eventify/backend/pkg/repository/inquiries"
	repoorder "github.com/eventify/backend/pkg/repository/order"
	reporeview "github.com/eventify/backend/pkg/repository/review"
	reposubscription "github.com/eventify/backend/pkg/repository/subscription"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"

	// Services (aliased)
	serviceanalytics "github.com/eventify/backend/pkg/services/analytics"
	serviceauth "github.com/eventify/backend/pkg/services/auth"
	serviceemail "github.com/eventify/backend/pkg/services/email"
	serviceevent "github.com/eventify/backend/pkg/services/event"
	servicefeedback "github.com/eventify/backend/pkg/services/feedback"
	serviceinquiries "github.com/eventify/backend/pkg/services/inquiries"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	serviceorder "github.com/eventify/backend/pkg/services/order"
	servicepaystack "github.com/eventify/backend/pkg/services/paystack"
	servicepricing "github.com/eventify/backend/pkg/services/pricing"
	servicereview "github.com/eventify/backend/pkg/services/review"
	servicesubscription "github.com/eventify/backend/pkg/services/subscription"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"

	// Handlers (aliased)
	handleranalytics "github.com/eventify/backend/pkg/handlers/analytics"
	handlerauth "github.com/eventify/backend/pkg/handlers/auth"
	handlerevent "github.com/eventify/backend/pkg/handlers/event"
	handlerfeedback "github.com/eventify/backend/pkg/handlers/feedback"
	handlerinquiries "github.com/eventify/backend/pkg/handlers/inquiries"
	handlerorder "github.com/eventify/backend/pkg/handlers/order"
	handlerreview "github.com/eventify/backend/pkg/handlers/review"
	handlersubscription "github.com/eventify/backend/pkg/handlers/subscription"
	handlervendor "github.com/eventify/backend/pkg/handlers/vendor"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

const serviceName = "eventify-api"

// startTokenCleanup schedules periodic cleanup of expired refresh tokens
func startTokenCleanup(refreshRepo repoauth.RefreshTokenRepository, authRepo repoauth.AuthRepository) {
	ticker := time.NewTicker(24 * time.Hour)

	// Helper to run both cleanups
	runCleanup := func() {
		ctx := context.Background()

		// 1. Clean up Expired Refresh Tokens
		deletedTokens, err := refreshRepo.CleanupExpiredTokens(ctx)
		if err != nil {
			utils.LogError(serviceName, "token-cleanup", "Refresh token cleanup failed", err)
		} else if deletedTokens > 0 {
			utils.LogInfo(serviceName, "token-cleanup", fmt.Sprintf("🧹 Cleaned up %d expired refresh tokens", deletedTokens))
		}

		// 2. NEW: Clean up Expired Blacklisted Access Tokens
		deletedBlacklist, err := authRepo.CleanupBlacklist(ctx)
		if err != nil {
			utils.LogError(serviceName, "token-cleanup", "Blacklist cleanup failed", err)
		} else if deletedBlacklist > 0 {
			utils.LogInfo(serviceName, "token-cleanup", fmt.Sprintf("🛡️ Cleaned up %d expired blacklist entries", deletedBlacklist))
		}
	}

	// Initial cleanup on startup
	go runCleanup()

	// Periodic cleanup every 24 hours
	go func() {
		for range ticker.C {
			runCleanup()
		}
	}()

	utils.LogSuccess(serviceName, "token-cleanup", "Full maintenance scheduler started (24-hour intervals)")
}

func main() {
	// ============================================================================
	// STEP 1: LOGGING CONFIGURATION
	// ============================================================================
	utils.InitLogger()
	env := os.Getenv("NODE_ENV")
	if env == "" {
		env = "development"
	}

	utils.LogInfo(serviceName, "startup", "🚀 Starting Eventify API [env=%s]", env)

	// ============================================================================
	// STEP 2: JWT SERVICE INITIALIZATION
	// ============================================================================
	jwtService := servicejwt.NewJWTService()
	if err := jwtService.Initialize(); err != nil {
		log.Fatal().
			Err(err).
			Str("service", serviceName).
			Str("operation", "jwt-init").
			Msg("💀 FATAL: Failed to initialize JWT service - check RSA key configuration")
	}
	utils.LogSuccess(serviceName, "jwt-init", "JWT service initialized")

	// ============================================================================
	// STEP 3: GIN MODE CONFIGURATION
	// ============================================================================
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}
	// ============================================================================
	// STEP 4: DATABASE INITIALIZATION
	// ============================================================================
	db.ConnectDB()
	utils.LogSuccess(serviceName, "database", "Database connection established")
	defer db.CloseDB()

	dbClient := db.GetDB()

	// ============================================================================
	// STEP 5: REPOSITORY INITIALIZATION
	// ============================================================================
	vendorRepo := repovendor.NewPostgresVendorRepository(dbClient)
	vendorStatsRepo := repovendor.NewPostgresVendorStatsRepo(dbClient)
	authRepo := repoauth.NewPostgresAuthRepository(dbClient)
	refreshTokenRepo := repoauth.NewPostgresRefreshTokenRepository(dbClient)
	reviewRepo := reporeview.NewPostgresReviewRepository(dbClient)
	inquiryRepo := repoinquiries.NewInquiryRepository(dbClient)
	feedbackRepo := repofeedback.NewFeedbackRepository(dbClient)
	orderRepo := repoorder.NewPostgresOrderRepository(dbClient)
	eventRepo := repoevent.NewPostgresEventRepository(dbClient)

	analyticsRepo := analytics.NewPostgresAnalyticsRepository(dbClient)
	vendorAnalyticsOptimizedRepo := repovendor.NewVendorAnalyticsOptimizedRepository(dbClient)
	vendorLeaderboardRepo := repovendor.NewVendorLeaderboardRepo(dbClient)
	subscriptionRepo := reposubscription.NewSubscriptionRepository(dbClient)

	utils.LogSuccess(serviceName, "repositories", "All repositories initialized")

	// STEP 6: SERVICE INITIALIZATION

	authService := serviceauth.NewAuthService(
		authRepo,
		refreshTokenRepo,
		vendorRepo,
		eventRepo,
		jwtService,
	)
	eventService := serviceevent.NewEventService(dbClient, eventRepo)
	vendorService := servicevendor.NewVendorService(vendorRepo)
	reviewService := servicereview.NewReviewService(reviewRepo, vendorRepo, inquiryRepo)
	inquiryService := serviceinquiries.NewInquiryService(inquiryRepo, inquiryRepo, vendorRepo)
	feedbackService := servicefeedback.NewFeedbackService(feedbackRepo)
	analyticsService := serviceanalytics.NewAnalyticsService(analyticsRepo)

	vendorAnalyticsService := servicevendor.NewVendorAnalyticsService(
		vendorAnalyticsOptimizedRepo,
	)
	vendorLeaderboardService := servicevendor.NewVendorLeaderboardService(vendorLeaderboardRepo)

	paystackClient := servicepaystack.NewClient(
		os.Getenv("PAYSTACK_SECRET_KEY"),
		&http.Client{Timeout: 10 * time.Second},
	)

	pricingService := servicepricing.NewPricingService(eventRepo)
	orderService := serviceorder.NewOrderService(
		orderRepo,
		eventRepo,
		pricingService,
		paystackClient,
	)
	subscriptionService := servicesubscription.NewSubscriptionService(
		vendorRepo,
		subscriptionRepo,
		authRepo,
		paystackClient,
		os.Getenv("PAYSTACK_SECRET_KEY"),
	)

	utils.LogSuccess(serviceName, "services", "All services initialized")

	// ============================================================================
	// STEP 7: HANDLER INITIALIZATION
	// ============================================================================
	authHandler := handlerauth.NewAuthHandler(authService)
	preferencesHandler := handlerauth.NewPreferencesHandler(authRepo)
	vendorLeaderboardHandler := handlervendor.NewVendorLeaderboardHandler(vendorLeaderboardService)
	vendorHandler := handlervendor.NewVendorHandler(vendorService, vendorStatsRepo)
	reviewHandler := handlerreview.NewReviewHandler(reviewService)
	inquiryHandler := handlerinquiries.NewInquiryHandler(inquiryService)
	feedbackHandler := handlerfeedback.NewFeedbackHandler(feedbackService)
	orderHandler := handlerorder.NewOrderHandler(orderService, subscriptionService)
	eventHandler := handlerevent.NewEventHandler(eventService)
	analyticsHandler := handleranalytics.NewAnalyticsHandler(analyticsService)

	vendorAnalyticsHandler := handlervendor.NewVendorAnalyticsHandler(vendorAnalyticsService, dbClient)
	subscriptionHandler := handlersubscription.NewSubscriptionHandler(subscriptionService, vendorRepo)

	utils.LogSuccess(serviceName, "handlers", "All handlers initialized")

	// ============================================================================
	// STEP 8: START BACKGROUND JOBS
	// ============================================================================
	workerCtx, stopWorkers := context.WithCancel(context.Background())
	defer stopWorkers()

	log.Info().Msg("Starting background workers...")

	startTokenCleanup(refreshTokenRepo, authRepo)
	go orderService.StartStockReleaseWorker(workerCtx, 1*time.Minute, 15*time.Minute)
		subInterval := time.Hour
	if d, err := time.ParseDuration(os.Getenv("SUBSCRIPTION_WORKER_INTERVAL")); err == nil && d > 0 {
		subInterval = d
	}
	go subscriptionService.StartExpiryWorker(context.Background(), subInterval)
	go servicevendor.StartLeaderboardRefreshWorker(workerCtx, dbClient, 1*time.Hour)
	go servicevendor.StartAnalyticsRefreshWorker(
		workerCtx,
		dbClient,
		1*time.Hour,
	)

	if emailSender, err := serviceemail.NewSenderFromEnv(); err != nil {
		utils.LogError(serviceName, "email", "Email worker NOT started", err)
	} else {
		go serviceemail.NewEmailWorker(dbClient, emailSender).Start(workerCtx, 5*time.Second)
	}

	log.Info().Msg("All background workers started successfully")

	// STEP 9: ROUTER CONFIGURATION
	router := routes.ConfigureRouter(
		authHandler,              // 1
		eventHandler,             // 2
		vendorHandler,            // 3
		reviewHandler,            // 4
		inquiryHandler,           // 5
		feedbackHandler,          // 6
		orderHandler,             // 7
		subscriptionHandler,      // 8
		authRepo,                 // 9
		analyticsHandler,         // 10
		vendorAnalyticsHandler,   // 11
		vendorLeaderboardHandler, // 12
		jwtService,               // 13
		authService,              // 14
		preferencesHandler,
	)

	utils.LogSuccess(serviceName, "router", "Router configured with all endpoints")

	// ============================================================================
	// STEP 10: SERVER CONFIGURATION AND STARTUP
	// ============================================================================
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	serverAddr := fmt.Sprintf(":%s", port)

	srv := &http.Server{
		Addr:              serverAddr,
		Handler:           router,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start server in goroutine
	go func() {
		utils.LogInfo(serviceName, "server", "🎉 Server listening on %s All systems operational", serverAddr)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().
				Err(err).
				Str("service", serviceName).
				Str("operation", "server-start").
				Str("addr", serverAddr).
				Msg("💀 Server failed to start")
		}
	}()

	// ============================================================================
	// STEP 11: GRACEFUL SHUTDOWN
	// ============================================================================
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	stopWorkers()

	utils.LogWarn(serviceName, "shutdown", "Shutdown signal received - initiating graceful shutdown", nil)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		utils.LogError(serviceName, "shutdown", "Server forced to shutdown", err)
	}

	utils.LogInfo(serviceName, "shutdown", "👋 Server stopped gracefully - goodbye!")
}