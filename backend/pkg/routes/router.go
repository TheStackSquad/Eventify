// backend/pkg/routes/router.go
package routes

import (
	"net/http"
	"time"

	handleranalytics "github.com/eventify/backend/pkg/handlers/analytics"
	handlerauth "github.com/eventify/backend/pkg/handlers/auth"
	handlerevent "github.com/eventify/backend/pkg/handlers/event"
	handlerfeedback "github.com/eventify/backend/pkg/handlers/feedback"
	handlerinquiries "github.com/eventify/backend/pkg/handlers/inquiries"
	handlerorder "github.com/eventify/backend/pkg/handlers/order"
	handlerreview "github.com/eventify/backend/pkg/handlers/review"
	handlervendor "github.com/eventify/backend/pkg/handlers/vendor"

	repoauth "github.com/eventify/backend/pkg/repository/auth"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"

	"github.com/eventify/backend/pkg/middleware"
	"github.com/eventify/backend/pkg/utils"

	"github.com/gin-contrib/cors"
	ginzerolog "github.com/gin-contrib/logger"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

const serviceName = "router"

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
	jwtService *servicejwt.JWTService,
) *gin.Engine {

	utils.LogInfo(serviceName, "configure", "Initializing router configuration")

	router := gin.New()
	router.RedirectTrailingSlash = false

	router.Use(gin.Recovery())
	router.Use(requestLogger())
	router.Use(ginzerolog.SetLogger())
	router.Use(corsConfig())

	log.Info().
		Bool("skip_localhost", utils.SkipLocalhostRateLimit).
		Msg("🔒 Rate limiting configured")

	router.Use(middleware.GuestMiddleware())
	router.Use(middleware.RateLimit(utils.PublicLimiter))

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

	auth := router.Group("/auth")
	auth.Use(middleware.RateLimit(utils.AuthLimiter))
	{
		auth.POST("/signup", authHandler.Signup)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.Logout)
		auth.GET("/me", middleware.AuthMiddleware(jwtService), authHandler.GetCurrentUser)
		auth.POST("/forgot-password", authHandler.ForgotPassword)
		auth.GET("/verify-reset-token", authHandler.VerifyResetToken)
		auth.POST("/reset-password", authHandler.ResetPassword)
	}

	paymentRoutes := router.Group("/api/payments")
	{
		paymentRoutes.GET("/verify/:reference", orderHandler.VerifyPayment)
	}

	orderRoutes := router.Group("/api/orders")
	orderRoutes.Use(middleware.RateLimit(utils.WriteLimiter))
	{
		orderRoutes.Use(middleware.OptionalAuth(jwtService))
		orderRoutes.POST("/initialize", orderHandler.InitializeOrder)
	}

	router.POST("/api/webhooks/paystack", orderHandler.HandlePaystackWebhook)

	vendorPublic := router.Group("/api/v1/vendors")
	{
		vendorPublic.GET("", vendorHandler.ListVendors)
		vendorPublic.GET("/:id", vendorHandler.GetVendorProfile)
	}

	vendorProtected := router.Group("/api/v1/vendors")
	vendorProtected.Use(middleware.AuthMiddleware(jwtService), middleware.RateLimit(utils.WriteLimiter))
	{
		vendorProtected.POST("/register", vendorHandler.RegisterVendor)
		vendorProtected.PATCH("/:id", vendorHandler.UpdateVendor)
	}

	vendorAnalytics := router.Group("/api/v1/vendors/:id/analytics")
	vendorAnalytics.Use(middleware.AuthMiddleware(jwtService))
	{
		vendorAnalytics.GET("/overview", vendorAnalyticsHandler.GetVendorAnalytics)
	}

	RegisterReviewRoutes(router, reviewHandler, jwtService)
	RegisterInquiryRoutes(router, inquiryHandler, jwtService)

	router.POST("/api/v1/feedback", middleware.RateLimit(utils.WriteLimiter), feedbackHandler.CreateFeedback)

	publicEvents := router.Group("/events")
	{
		publicEvents.GET("", eventHandler.GetAllEvents)
		publicEvents.GET("/:eventId", eventHandler.GetPublicEventByID)
		publicEvents.POST("/:eventId/like",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.OptionalAuth(jwtService),
			eventHandler.ToggleLike,
		)
	}

	protectedEvents := router.Group("/api/events")
	protectedEvents.Use(middleware.AuthMiddleware(jwtService))
	{
		protectedEvents.POST("/create", middleware.RateLimit(utils.WriteLimiter), eventHandler.CreateEvent)
		protectedEvents.GET("/my-events", eventHandler.GetUserEvents)
		protectedEvents.GET("/:eventId", eventHandler.GetEventByID)
		protectedEvents.PUT("/:eventId", middleware.RateLimit(utils.WriteLimiter), eventHandler.UpdateEvent)
		protectedEvents.DELETE("/:eventId", eventHandler.DeleteEvent)
		protectedEvents.GET("/:eventId/analytics", analyticsHandler.FetchEventAnalytics)
	}

	// --- TICKET GATE ROUTES ---
    // Protected routes for event staff/organizers to check in attendees
    gateRoutes := router.Group("/api/v1/gate")
    gateRoutes.Use(middleware.AuthMiddleware(jwtService), middleware.RateLimit(utils.WriteLimiter))
    {
        // POST /api/v1/gate/check-in
        // Body: { "code": "REF-001-SIGNATURE" }
        gateRoutes.POST("/check-in", eventHandler.CheckIn) 
    }

	setupAdminRoutes(router, authHandler, eventHandler, vendorHandler, reviewHandler, inquiryHandler, feedbackHandler, authRepo, jwtService)

	utils.LogSuccess(serviceName, "configure", "Router configuration completed")
	printRegisteredRoutes(router)
	
	return router
}

func setupAdminRoutes(
	r *gin.Engine,
	ah *handlerauth.AuthHandler,
	eh *handlerevent.EventHandler,
	vh *handlervendor.VendorHandler,
	rh *handlerreview.ReviewHandler,
	ih *handlerinquiries.InquiryHandler,
	fh *handlerfeedback.FeedbackHandler,
	repo repoauth.AuthRepository,
	jwtService *servicejwt.JWTService,
) {
	admin := r.Group("/api/v1/admin")
	admin.Use(middleware.AuthMiddleware(jwtService), middleware.AdminMiddleware(repo))
	{
		admin.PUT("/vendors/:id/verify/identity", vh.ToggleIdentityVerification)
		admin.GET("/feedback", fh.GetAllFeedback)
		admin.DELETE("/feedback/:id", fh.DeleteFeedback)
	}
}

func RegisterReviewRoutes(r *gin.Engine, reviewHandler *handlerreview.ReviewHandler, jwtService *servicejwt.JWTService) {
	v1 := r.Group("/api/v1/vendors/:id/reviews")
	{
		v1.GET("", reviewHandler.GetVendorReviews)
		v1.POST("",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.OptionalAuth(jwtService),
			reviewHandler.CreateReview,
		)
	}
}

func RegisterInquiryRoutes(r *gin.Engine, inquiryHandler *handlerinquiries.InquiryHandler, jwtService *servicejwt.JWTService) {
	inquiries := r.Group("/api/v1/inquiries")
	{
		inquiries.POST("/vendor/:vendor_id",
			middleware.RateLimit(utils.WriteLimiter),
			middleware.GuestMiddleware(),
			middleware.OptionalAuth(jwtService),
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
	utils.LogDebug(serviceName, "routes", "Registered routes:")
	for _, route := range router.Routes() {
		log.Debug().Str("method", route.Method).Str("path", route.Path).Msg("  Route")
	}
}