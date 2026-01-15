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
	"eventify/backend/pkg/utils"

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
	"github.com/rs/zerolog/log"
)

const serviceName = "eventify-api"

// startTokenCleanup schedules periodic cleanup of expired refresh tokens
func startTokenCleanup(repo repoauth.RefreshTokenRepository) {
	ticker := time.NewTicker(24 * time.Hour)
	
	// Initial cleanup
	go func() {
		ctx := context.Background()
		deleted, err := repo.CleanupExpiredTokens(ctx)
		if err != nil {
			utils.LogError(serviceName, "token-cleanup", "Initial cleanup failed", err)
		} else {
			utils.LogSuccess(serviceName, "token-cleanup", fmt.Sprintf("Initial cleanup completed (%d tokens)", deleted))
		}
	}()

	// Periodic cleanup
	go func() {
		for range ticker.C {
			ctx := context.Background()
			deleted, err := repo.CleanupExpiredTokens(ctx)
			if err != nil {
				utils.LogError(serviceName, "token-cleanup", "Scheduled cleanup failed", err)
			} else {
				utils.LogInfo(serviceName, "token-cleanup", "🧹 Scheduled cleanup completed (%d tokens)", deleted)
			}
		}
	}()

	utils.LogSuccess(serviceName, "token-cleanup", "Cleanup scheduler started (24-hour intervals)")
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

	utils.LogSuccess(serviceName, "repositories", "All repositories initialized")

	// ============================================================================
	// STEP 6: SERVICE INITIALIZATION
	// ============================================================================
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
		FrontendBaseURL: os.Getenv("FRONTEND_URL"),
	}

	pricingService := servicepricing.NewPricingService(eventRepo)
	orderService := serviceorder.NewOrderService(
		orderRepo,
		eventRepo,
		pricingService,
		paystackClient,
	)

	utils.LogSuccess(serviceName, "services", "All services initialized")

	// ============================================================================
	// STEP 7: HANDLER INITIALIZATION
	// ============================================================================
	authHandler := handlerauth.NewAuthHandler(authRepo, refreshTokenRepo, jwtService)
	eventHandler := handlerevent.NewEventHandler(eventService, likeService)
	vendorHandler := handlervendor.NewVendorHandler(vendorService)
	reviewHandler := handlerreview.NewReviewHandler(reviewService)
	inquiryHandler := handlerinquiries.NewInquiryHandler(inquiryService)
	feedbackHandler := handlerfeedback.NewFeedbackHandler(feedbackService)
	orderHandler := handlerorder.NewOrderHandler(orderService)
	analyticsHandler := handleranalytics.NewAnalyticsHandler(analyticsService)
	vendorAnalyticsHandler := handlervendor.NewVendorAnalyticsHandler(vendorAnalyticsService)

	utils.LogSuccess(serviceName, "handlers", "All handlers initialized")

	// ============================================================================
	// STEP 8: START BACKGROUND JOBS
	// ============================================================================
	startTokenCleanup(refreshTokenRepo)
	go orderService.StartStockReleaseWorker(context.Background(), 1*time.Minute, 15*time.Minute)

	// ============================================================================
	// STEP 9: ROUTER CONFIGURATION
	// ============================================================================
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
		jwtService,
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
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		utils.LogInfo(serviceName, "server", "🎉 Server listening on %s - All systems operational", serverAddr)

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

	utils.LogWarn(serviceName, "shutdown", "Shutdown signal received - initiating graceful shutdown", nil)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		utils.LogError(serviceName, "shutdown", "Server forced to shutdown", err)
	}

	utils.LogInfo(serviceName, "shutdown", "👋 Server stopped gracefully - goodbye!")
}