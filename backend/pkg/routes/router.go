//backend/pkg/routes/router.go

package routes

import (
	"net/http"
	"time"

	"eventify/backend/pkg/handlers"
	"eventify/backend/pkg/middleware"
	"eventify/backend/pkg/repository"

	"github.com/gin-contrib/cors"
	ginzerolog "github.com/gin-contrib/logger"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// ConfigureRouter sets up all application routes and middleware.
func ConfigureRouter(
    authHandler *handlers.AuthHandler,
    eventHandler *handlers.EventHandler,
    vendorHandler *handlers.VendorHandler,
    reviewHandler *handlers.ReviewHandler,
    inquiryHandler *handlers.InquiryHandler,
    feedbackHandler *handlers.FeedbackHandler,
    orderHandler *handlers.OrderHandler,
    authRepo repository.AuthRepository,
    analyticsHandler *handlers.AnalyticsHandler,
) *gin.Engine {
	router := gin.New()
	router.RedirectTrailingSlash = false

	// --- Middleware Stack ---
	router.Use(gin.Recovery())
	router.Use(requestLogger())
	router.Use(ginzerolog.SetLogger())
	router.Use(corsConfig())

	// --- Health Check ---
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Eventify API is running",
			"status":  "healthy",
		})
	})

	// -------------------------------------------------------------------
	// 1. PUBLIC ROUTES & PAYMENT INTEGRATION ROUTES
	// -------------------------------------------------------------------
	auth := router.Group("/auth")
	{
		auth.POST("/signup", authHandler.Signup)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.Logout)

		// PASSWORD RESET ROUTES
		auth.POST("/forgot-password", authHandler.ForgotPassword)
		auth.GET("/verify-reset-token", authHandler.VerifyResetToken)
		auth.POST("/reset-password", authHandler.ResetPassword)
	}

	// 🆕 PAYMENT VERIFICATION ROUTES
	paymentRoutes := router.Group("/api/payments")
	{
		// 1. Client-Initiated Verification: Used by confirmation/page.js
		paymentRoutes.GET("/verify/:reference", orderHandler.VerifyPayment)
	}
    
    // 🆕 ORDER INITIALIZATION ROUTES (FIX ADDED HERE)
    orderRoutes := router.Group("/api/orders")
    {
        // 2. Order Initialization: The critical first step for the secure flow.
        // Frontend POSTs purchase intent; server validates and returns secure reference.
        orderRoutes.POST("/initialize", orderHandler.InitializeOrder)
    }

	// 🆕 WEBHOOK ROUTE (No Auth Required)
	// This endpoint receives server-to-server notifications from Paystack. It is the primary trigger for order processing.
	router.POST("/api/webhooks/paystack", orderHandler.HandlePaystackWebhook)


	log.Info().Msg("🚀 Registering vendor routes...")

	vendorRoutes := router.Group("/api/v1/vendors")
	{
		vendorRoutes.GET("", vendorHandler.ListVendors)
		vendorRoutes.GET("/:id", vendorHandler.GetVendorProfile)
		vendorRoutes.POST("/register", vendorHandler.RegisterVendor)
	}

	// ✅ Register review routes — supports optional auth
	RegisterReviewRoutes(router, reviewHandler)

	// ✅ Register inquiry routes
	RegisterInquiryRoutes(router, inquiryHandler)

	// PUBLIC FEEDBACK ROUTE (no auth required)
	router.POST("/api/v1/feedback", feedbackHandler.CreateFeedback)

// -------------------------------------------------------------------
// PUBLIC EVENT ROUTES (No Auth Required)
// -------------------------------------------------------------------
publicEvents := router.Group("/events")
{
	publicEvents.GET("", eventHandler.GetAllEventsHandler)      // Browse all events
	publicEvents.GET("/:eventId", eventHandler.GetPublicEventByID)    // View event details
}

// -------------------------------------------------------------------
// PROTECTED EVENT ROUTES (Auth Required)
// -------------------------------------------------------------------
//protectedEvents := router.Group("/events")
protectedEvents := router.Group("/api/events")
protectedEvents.Use(middleware.AuthMiddleware())
{
	protectedEvents.GET("/my-events", eventHandler.GetUserEventsHandler)
	protectedEvents.GET("/:eventId", eventHandler.GetEventByID)
	protectedEvents.PUT("/:eventId", eventHandler.UpdateEvent)
	protectedEvents.DELETE("/:eventId", eventHandler.DeleteEvent)
	protectedEvents.POST("/:eventId/like", eventHandler.ToggleLikeHandler)
	//protectedEvents.GET("/:eventId/analytics", eventHandler.FetchEventAnalytics)
	// Main analytics endpoint
		// GET /api/events/:eventId/analytics
		// GET /api/events/:eventId/analytics?includeTimeline=true
		protectedEvents.GET("/:eventId/analytics", analyticsHandler.FetchEventAnalytics)
}

	// -------------------------------------------------------------------
	// 3. ADMIN ROUTES
	// -------------------------------------------------------------------
	adminVendor := router.Group("/api/v1/admin/vendors")
	adminVendor.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware(authRepo))
	{
		adminVendor.PUT("/:id/verify/identity", vendorHandler.ToggleIdentityVerification)
		adminVendor.PUT("/:id/verify/business", vendorHandler.ToggleBusinessVerification)
		adminVendor.DELETE("/:id", vendorHandler.DeleteVendor)
	}

	// ✅ Admin review routes (for moderation)
	adminReviews := router.Group("/api/v1/admin/reviews")
	adminReviews.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware(authRepo))
	{
		adminReviews.PATCH("/:id/status", reviewHandler.UpdateReviewApprovalStatus)
	}

	// ✅ Admin inquiry routes
	adminInquiries := router.Group("/api/v1/admin/inquiries")
	adminInquiries.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware(authRepo))
	{
		adminInquiries.PATCH("/:id", inquiryHandler.UpdateInquiryStatus)
	}

	// ADMIN FEEDBACK ROUTES
	adminFeedback := router.Group("/api/v1/admin/feedback")
	adminFeedback.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware(authRepo))
	{
		adminFeedback.GET("", feedbackHandler.GetAllFeedback)
		adminFeedback.DELETE("/:id", feedbackHandler.DeleteFeedback)
	}

	// Print all routes for debugging
	printRegisteredRoutes(router)

	return router
}

// ... (Rest of the file remains the same)

// ✅ Review route registration
func RegisterReviewRoutes(r *gin.Engine, reviewHandler *handlers.ReviewHandler) {
	reviews := r.Group("/api/vendors/:vendor_id/reviews")
	{
		reviews.GET("", reviewHandler.GetVendorReviews) 					// Public - gets approved reviews
		reviews.POST("", middleware.OptionalAuth(), reviewHandler.CreateReview) // Optional auth - supports anonymous
	}
}

// ✅ Inquiry route registration
func RegisterInquiryRoutes(r *gin.Engine, inquiryHandler *handlers.InquiryHandler) {
	inquiries := r.Group("/api/v1/inquiries")
	{
		inquiries.POST("/vendor/:vendor_id", inquiryHandler.CreateInquiry)
		inquiries.GET("/vendor/:vendor_id", inquiryHandler.GetVendorInquiries)
	}
}

// --- Utility Middleware Helpers ---
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		log.Info().
			Str("method", c.Request.Method).
			Str("path", path).
			Str("query", query).
			Int("status", c.Writer.Status()).
			Str("latency", time.Since(start).String()).
			Msg("📥 HTTP Request")
	}
}

func corsConfig() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "HEAD", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

func printRegisteredRoutes(router *gin.Engine) {
	log.Info().Msg("🔍 === REGISTERED ROUTES ===")
	for _, route := range router.Routes() {
		log.Info().Str("method", route.Method).Str("path", route.Path).Msg("Route")
	}
	log.Info().Msg("🔍 =========================")
}