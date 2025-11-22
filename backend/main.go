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

	"eventify/backend/pkg/analytics"      // ✅ ADD THIS IMPORT
	"eventify/backend/pkg/db"
	"eventify/backend/pkg/handlers"
	"eventify/backend/pkg/repository"
	"eventify/backend/pkg/routes"
	"eventify/backend/pkg/services"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// ------------------------------------------------------------
	// 1️⃣ Logging / Mode Setup
	// ------------------------------------------------------------
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
	}).With().Timestamp().Logger()

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// ------------------------------------------------------------
	// 2️⃣ Database Initialization
	// ------------------------------------------------------------
	db.ConnectDB()
	log.Info().Msg("Database connection established successfully.")

	// Get both: Database AND Client
	dbClient := db.GetDB()
	mongoClient := db.Client

	eventsCollection := dbClient.Collection("events")
	vendorsCollection := dbClient.Collection("vendors")
	usersCollection := dbClient.Collection("users")
	likesCollection := dbClient.Collection("likes")
	reviewsCollection := dbClient.Collection("reviews")
	inquiriesCollection := dbClient.Collection("inquiries")
	feedbackCollection := dbClient.Collection("feedback")
	ordersCollection := dbClient.Collection("orders")
	ticketsCollection := dbClient.Collection("tickets")

	// ------------------------------------------------------------
	// 3️⃣ Repositories
	// ------------------------------------------------------------
	vendorRepo := repository.NewMongoVendorRepository(vendorsCollection)
	authRepo := repository.NewMongoAuthRepository(usersCollection)
	likeRepo := repository.NewLikeRepository(likesCollection)
	reviewRepo := repository.NewMongoReviewRepository(reviewsCollection)
	inquiryRepo := repository.NewMongoInquiryRepository(inquiriesCollection)
	feedbackRepo := repository.NewFeedbackRepository(feedbackCollection)
	
	// Order repository with mongo client for transactions
	orderRepo := repository.NewMongoOrderRepository(
		mongoClient,
		ordersCollection,
		ticketsCollection,
	)
	
	// Event repository for stock management
	eventRepo := repository.NewMongoEventRepository(eventsCollection, ticketsCollection)

	// ✅ Analytics Repository (NEW)
	analyticsRepo := analytics.NewAnalyticsRepository(
		eventsCollection,   // ✅ FIXED: Use eventsCollection (not eventCollection)
		ordersCollection,   // ✅ FIXED: Use ordersCollection (not orderCollection)
		ticketsCollection,  // ✅ FIXED: Use ticketsCollection (not ticketCollection)
	)

	// ------------------------------------------------------------
	// 4️⃣ Services
	// ------------------------------------------------------------
	eventService := services.NewEventService(eventsCollection)
	likeService := services.NewLikeService(likeRepo)
	vendorService := services.NewVendorService(vendorRepo)
	reviewService := services.NewReviewService(reviewRepo, vendorRepo)
	inquiryService := services.NewInquiryService(inquiryRepo, vendorRepo)
	feedbackService := services.NewFeedbackService(feedbackRepo)
	
	// ✅ Analytics Service (NEW)
	analyticsService := services.NewAnalyticsService(analyticsRepo)
	
	// Paystack client configuration
	paystackClient := &services.PaystackClient{
		SecretKey:  os.Getenv("PAYSTACK_SECRET_KEY"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
	
	// Pricing service for server-side calculations
	pricingService := services.NewPricingService(eventRepo)
	
	// Order service with all dependencies
	orderService := services.NewOrderService(
		orderRepo,
		eventRepo,
		pricingService,
		paystackClient,
	)

	// ------------------------------------------------------------
	// 5️⃣ Handlers
	// ------------------------------------------------------------
	authHandler := handlers.NewAuthHandler(authRepo, dbClient)
	eventHandler := handlers.NewEventHandler(*eventService, likeService)
	vendorHandler := handlers.NewVendorHandler(vendorService)
	reviewHandler := handlers.NewReviewHandler(reviewService)
	inquiryHandler := handlers.NewInquiryHandler(inquiryService)
	feedbackHandler := handlers.NewFeedbackHandler(feedbackService)
	orderHandler := handlers.NewOrderHandler(orderService)
	
	// ✅ Analytics Handler (NEW)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService)

	// ------------------------------------------------------------
	// 6️⃣ Router Setup
	// ------------------------------------------------------------
	router := routes.ConfigureRouter(
		authHandler,
		eventHandler,
		vendorHandler,
		reviewHandler,
		inquiryHandler,
		feedbackHandler,
		orderHandler,
		authRepo,
		analyticsHandler, // ✅ PASS ANALYTICS HANDLER
	)

	// ------------------------------------------------------------
	// 7️⃣ Server Setup
	// ------------------------------------------------------------
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

	// ------------------------------------------------------------
	// 8️⃣ Start Server
	// ------------------------------------------------------------
	go func() {
		log.Info().
			Str("service", "eventify-api").
			Str("addr", serverAddr).
			Msgf("🚀 Starting server on %s (http://localhost%s)", serverAddr, serverAddr)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).
				Str("addr", serverAddr).
				Msg("Could not listen on address")
		}
	}()

	// ------------------------------------------------------------
	// 9️⃣ Graceful Shutdown
	// ------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Warn().Msg("🧨 Server shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	db.CloseDB()
	log.Info().Msg("✅ MongoDB disconnected and server stopped gracefully.")
}