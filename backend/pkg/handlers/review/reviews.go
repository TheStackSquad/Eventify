// backend/pkg/handlers/review/reviews.go

package handlers

import (
	"net/http"
	"github.com/eventify/backend/pkg/models"
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

	var review models.Review
	if err := c.ShouldBindJSON(&review); err != nil {
		log.Error().Err(err).Msg("Failed to bind review JSON payload")
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request data."})
		return
	}

	review.VendorID = vendorID

	// Set reviewer identity and trust level
	if val, exists := c.Get("user_id"); exists {
		if u, ok := val.(uuid.UUID); ok {
			userIDCopy := u
			review.UserID = &userIDCopy
			review.IsVerified = true
		}
	}

	// Guest user handling
	if review.UserID == nil {
		if gIDVal, exists := c.Get("guest_id"); exists {
			if gID, ok := gIDVal.(string); ok {
				review.IPAddress = models.ToNullString(gID)
			}
		} else {
			review.IPAddress = models.ToNullString(c.ClientIP())
		}
		review.IsVerified = false
	}

	log.Info().
		Str("vendor_id", vendorID.String()).
		Str("email", review.Email).
		Bool("is_verified", review.IsVerified).
		Msg("Creating review")

	if err := h.reviewService.CreateReview(c.Request.Context(), &review); err != nil {
		if err.Error() == "already reviewed" {
			c.JSON(http.StatusConflict, gin.H{"message": "You have already submitted a review."})
			return
		}
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
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

