// backend/pkg/handlers/review/reviews.go

package handlers

import (
	"net/http"
	"errors"
	"strings"
    "database/sql"
	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/repository/review"
	 servicereview "github.com/eventify/backend/pkg/services/review"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type ReviewHandler struct {
	reviewService servicereview.ReviewService
}

func NewReviewHandler(reviewService servicereview.ReviewService) *ReviewHandler {
	return &ReviewHandler{
		reviewService: reviewService,
	}
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	idParam := c.Param("id")
	vendorID, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid vendor ID format."})
		return
	}

	// 1. DTO to capture raw JSON strings (sql.NullString won't bind directly from strings)
type CreateReviewRequest struct {
        UserName string `json:"user_name" binding:"required"` 
        Email    string `json:"email"     binding:"required,email"`
        Rating   int32  `json:"rating"    binding:"required,min=1,max=5"`
        Comment  string `json:"comment"   binding:"required"`
    }

	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("Failed to bind review JSON payload")
		c.JSON(http.StatusBadRequest, gin.H{"message": "Please provide all required fields correctly."})
		return
	}

// Map DTO to the model
    reviewModel := models.Review{
        ID:       uuid.New(),
        VendorID: vendorID,
        UserName: sql.NullString{String: req.UserName, Valid: req.UserName != ""},
        Email:    sql.NullString{String: req.Email,    Valid: req.Email != ""},
        Rating:   req.Rating,
        Comment:  req.Comment,
    }

	// 3. Set reviewer identity logic from Auth Middleware
	if val, exists := c.Get("user_id"); exists {
		if u, ok := val.(uuid.UUID); ok {
			userIDCopy := u
			reviewModel.UserID = &userIDCopy
			reviewModel.IsVerified = true
		}
	}

	// 4. Guest user handling (Identity by IP/GuestID)
	if reviewModel.UserID == nil {
		if gIDVal, exists := c.Get("guest_id"); exists {
			if gID, ok := gIDVal.(string); ok {
				reviewModel.IPAddress = models.ToNullString(gID)
			}
		} else {
			reviewModel.IPAddress = models.ToNullString(c.ClientIP())
		}
		reviewModel.IsVerified = false
	}

	log.Info().
		Str("vendor_id", vendorID.String()).
		Str("email", reviewModel.Email.String). // Fixed: Access .String property
		Bool("is_verified", reviewModel.IsVerified).
		Msg("Creating review")

	// 5. Execute Service Call
	err = h.reviewService.CreateReview(c.Request.Context(), &reviewModel)

	if err != nil {
		// Handle Duplicate Constraint Violations
		if errors.Is(err, review.ErrDuplicateReview) || 
		   strings.Contains(err.Error(), "23505") || 
		   strings.Contains(err.Error(), "idx_reviews_one_per_user_vendor") {
			
			c.JSON(http.StatusConflict, gin.H{
				"message": "You've already reviewed this vendor",
				"errorCode": "REVIEW_DUPLICATE",
			})
			return
		}

		log.Error().Err(err).Msg("Review creation failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "An unexpected error occurred while saving your review.",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Review submitted successfully!"})
}

func (h *ReviewHandler) GetVendorReviews(c *gin.Context) {
    // 1. Align with the router: Use "id" as the key
    vendorIDParam := c.Param("id") 
    
    if vendorIDParam == "" {
        c.JSON(http.StatusBadRequest, gin.H{"message": "Vendor ID is required"})
        return
    }

    // Optional: Validate that it's a valid UUID before hitting the DB
    if _, err := uuid.Parse(vendorIDParam); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid Vendor ID format"})
        return
    }

    // 2. Determine Permission Level (REMOVED: Simplified access model)
    // The Trust Engine and repository query now handle filtering/moderation.
    
    var reviews []models.Review
    var err error

    // 3. Service Call Logic (FIX: Call the single, trusted method)
    // This single call retrieves the final set of reviews for display.
    reviews, err = h.reviewService.GetReviewsByVendor(c.Request.Context(), vendorIDParam)
    
    // Original obsolete logic that was removed:
    /*
    if isAdmin {
        reviews, err = h.reviewService.GetReviewsByVendor(c.Request.Context(), vendorIDParam)
    } else {
        reviews, err = h.reviewService.GetApprovedReviewsByVendor(c.Request.Context(), vendorIDParam)
    }
    */

    if err != nil {
        log.Error().Err(err).Str("vendor_id", vendorIDParam).Msg("Failed to fetch reviews")
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch reviews"})
        return
    }

    // 4. Solid Response Structure
    c.JSON(http.StatusOK, gin.H{
        "vendor_id": vendorIDParam,
        "count": len(reviews),
        "reviews": reviews,
    })
}

