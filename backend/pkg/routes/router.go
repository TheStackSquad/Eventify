// backend/pkg/routes/router.go

package routes

import (
	"net/http"
	"time"

	handleranalytics "eventify/backend/pkg/handlers/analytics"
	handlerauth "eventify/backend/pkg/handlers/auth"
	handlerevent "eventify/backend/pkg/handlers/event"
	handlerfeedback "eventify/backend/pkg/handlers/feedback"
	handlerinquiries "eventify/backend/pkg/handlers/inquiries"
	handlerorder "eventify/backend/pkg/handlers/order"
	handlerreview "eventify/backend/pkg/handlers/review"
	handlervendor "eventify/backend/pkg/handlers/vendor"

	repoauth "eventify/backend/pkg/repository/auth"

	"eventify/backend/pkg/middleware"
	"eventify/backend/pkg/utils"

	"github.com/gin-contrib/cors"
	ginzerolog "github.com/gin-contrib/logger"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

func ConfigureRouter(
	authHandler *handlerauth.AuthHandler,
	eventHandler *handlerevent.EventHandler,
	vendorHandler *handlervendor.VendorHandler,
	reviewHandler *handlerreview.ReviewHandler,
	inquiryHandler *handlerinquiries.InquiryHandler,
	feedbackHandler *handlerfeedback.FeedbackHandler,
	orderHandler *handlerorder.OrderHandler,
	authRepo repoauth.AuthRepository,
	analyticsHandler *handleranalytics.AnalyticsHandler,
	vendorAnalyticsHandler *handlervendor.VendorAnalyticsHandler,
) *gin.Engine {

	router := gin.New()
	router.RedirectTrailingSlash = false

	// --- GLOBAL MIDDLEWARE ---
	router.Use(gin.Recovery())
	router.Use(requestLogger())
	router.Use(ginzerolog.SetLogger())
	router.Use(corsConfig())

	// Log rate limiting configuration on startup
	log.Info().
		Bool("skip_localhost", utils.SkipLocalhostRateLimit).
		Msg("🔒 Rate limiting configured")

	// 1. Establish Identity First
	router.Use(middleware.GuestMiddleware())

	// 2. Apply a General Public Rate Limit (prevent scraping/DDoS)
	router.Use(middleware.RateLimit(utils.PublicLimiter))

	// Health check endpoints
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Eventify API is running",
			"status":  "healthy",
		})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"rate_limiting": gin.H{
				"skip_localhost": utils.SkipLocalhostRateLimit,
			},
		})
	})

	// --- AUTH ROUTES (Strict Limiting) ---
	auth := router.Group("/auth")
	auth.Use(middleware.RateLimit(utils.AuthLimiter))
	{
		auth.POST("/signup", authHandler.Signup)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.Logout)
		auth.GET("/me", middleware.AuthMiddleware(), authHandler.GetCurrentUser)
		auth.POST("/forgot-password", authHandler.ForgotPassword)
		auth.GET("/verify-reset-token", authHandler.VerifyResetToken)
		auth.POST("/reset-password", authHandler.ResetPassword)
	}

	// --- PAYMENT & ORDERS ---
	paymentRoutes := router.Group("/api/payments")
	{
		paymentRoutes.GET("/verify/:reference", orderHandler.VerifyPayment)
	}

	orderRoutes := router.Group("/api/orders")
	orderRoutes.Use(middleware.RateLimit(utils.WriteLimiter)) // Prevent order initialization spam
	{
		orderRoutes.Use(middleware.OptionalAuth())
		orderRoutes.POST("/initialize", orderHandler.InitializeOrder)
	}

	// Webhook (No rate limit - handled by Paystack signature verification)
	router.POST("/api/webhooks/paystack", orderHandler.HandlePaystackWebhook)

	// --- VENDOR ROUTES ---
	vendorPublic := router.Group("/api/v1/vendors")
	{
		vendorPublic.GET("", vendorHandler.ListVendors)
		vendorPublic.GET("/:id", vendorHandler.GetVendorProfile)
	}

	vendorProtected := router.Group("/api/v1/vendors")
	vendorProtected.Use(middleware.AuthMiddleware(), middleware.RateLimit(utils.WriteLimiter))
	{
		vendorProtected.POST("/register", vendorHandler.RegisterVendor)
	}

	vendorAnalytics := router.Group("/api/v1/vendors/:id/analytics")
	vendorAnalytics.Use(middleware.AuthMiddleware())
	{
		vendorAnalytics.GET("/overview", vendorAnalyticsHandler.GetVendorAnalytics)
	}

	// --- REVIEWS & INQUIRIES ---
	RegisterReviewRoutes(router, reviewHandler)
	RegisterInquiryRoutes(router, inquiryHandler)

	// --- FEEDBACK (Write Limited) ---
	router.POST("/api/v1/feedback", middleware.RateLimit(utils.WriteLimiter), feedbackHandler.CreateFeedback)

	// --- EVENT ROUTES ---
	publicEvents := router.Group("/events")
	{
		publicEvents.GET("", eventHandler.GetAllEvents)
		publicEvents.GET("/:eventId", eventHandler.GetPublicEventByID)
		publicEvents.POST("/:eventId/like",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.OptionalAuth(),
			eventHandler.ToggleLike,
		)
	}

	protectedEvents := router.Group("/api/events")
	protectedEvents.Use(middleware.AuthMiddleware())
	{
		protectedEvents.POST("/create", middleware.RateLimit(utils.WriteLimiter), eventHandler.CreateEvent)
		protectedEvents.GET("/my-events", eventHandler.GetUserEvents)
		protectedEvents.GET("/:eventId", eventHandler.GetEventByID)
		protectedEvents.PUT("/:eventId", middleware.RateLimit(utils.WriteLimiter), eventHandler.UpdateEvent)
		protectedEvents.DELETE("/:eventId", eventHandler.DeleteEvent)
		protectedEvents.GET("/:eventId/analytics", analyticsHandler.FetchEventAnalytics)
	}

	// --- ADMIN ROUTES ---
	setupAdminRoutes(router, authHandler, eventHandler, vendorHandler, reviewHandler, inquiryHandler, feedbackHandler, authRepo)

	printRegisteredRoutes(router)
	return router
}

func setupAdminRoutes(r *gin.Engine, ah *handlerauth.AuthHandler, eh *handlerevent.EventHandler, vh *handlervendor.VendorHandler, rh *handlerreview.ReviewHandler, ih *handlerinquiries.InquiryHandler, fh *handlerfeedback.FeedbackHandler, repo repoauth.AuthRepository) {
	admin := r.Group("/api/v1/admin")
	admin.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware(repo))
	{
		admin.PUT("/vendors/:id/verify/identity", vh.ToggleIdentityVerification)
		admin.GET("/feedback", fh.GetAllFeedback)
		admin.DELETE("/feedback/:id", fh.DeleteFeedback)
	}
}

func RegisterReviewRoutes(r *gin.Engine, reviewHandler *handlerreview.ReviewHandler) {
	v1 := r.Group("/api/v1/vendors/:id/reviews")
	{
		v1.GET("", reviewHandler.GetVendorReviews)
		v1.POST("",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.OptionalAuth(),
			reviewHandler.CreateReview,
		)
	}
}

func RegisterInquiryRoutes(r *gin.Engine, inquiryHandler *handlerinquiries.InquiryHandler) {
	inquiries := r.Group("/api/v1/inquiries")
	{
		inquiries.POST("/vendor/:vendor_id",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.GuestMiddleware(),
			middleware.OptionalAuth(),
			inquiryHandler.CreateInquiry,
		)
		inquiries.GET("/vendor/:vendor_id", inquiryHandler.GetVendorInquiries)
	}
}

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
	log.Info().Msg("🔍 Registered Routes:")
	for _, route := range router.Routes() {
		log.Info().Str("method", route.Method).Str("path", route.Path).Msg("Route")
	}
}