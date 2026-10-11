// backend/pkg/models/vendor_analytics.go

package models
import (
 "time"
"github.com/google/uuid"
)

type TierRestrictions struct {
	Tier            string   `json:"tier"`
	Message         string   `json:"message"`
	MissingFeatures []string `json:"missing_features,omitempty"`
}
// ============================================================================
// MAIN RESPONSE STRUCTURE
// ============================================================================

// VendorAnalyticsResponse is the top-level response returned to the client
// Matches frontend state for vendor analytics dashboard
type VendorAnalyticsResponse struct {
	VendorID    string              `json:"vendorId"`
	VendorName  string              `json:"vendorName"`
	Category    string              `json:"category"`
	Overview    VendorOverview      `json:"overview"`
	Inquiries   VendorInquiries     `json:"inquiries"`
	Reviews     VendorReviews       `json:"reviews"`
	Trends      VendorTrends        `json:"trends"`
	Performance VendorPerformance   `json:"performance"`
	Restrictions *TierRestrictions `json:"restrictions,omitempty"`
}

// ============================================================================
// OVERVIEW DATA (Top-level KPIs)
// ============================================================================

// VendorOverview contains high-level metrics for dashboard stat cards
type VendorOverview struct {
	CurrentPVSScore      int     `json:"currentPvsScore"`
	TotalInquiries       int     `json:"totalInquiries"`
	ProfileCompletion    float64 `json:"profileCompletion"`    // %
	AverageRating        float64 `json:"averageRating"`        // 0-5 scale
	TotalReviews         int     `json:"totalReviews"`
	TotalViews   int `json:"totalViews"` 
    Views30d     int `json:"views30d"`
	IsVerified           bool    `json:"isVerified"`           // Identity OR Business
	IsIdentityVerified bool    `json:"isIdentityVerified"`
    IsBusinessVerified bool    `json:"isBusinessVerified"` 
    IsFullyVerified    bool    `json:"isFullyVerified"`
}

// ============================================================================
// INQUIRIES DATA (Customer Interest Metrics)
// ============================================================================

// VendorInquiries contains inquiry-related metrics and status breakdown
type VendorInquiries struct {
	Total              int                `json:"total"`              // All inquiries
	Pending            int                `json:"pending"`            // Status = "pending"
	Responded          int                `json:"responded"`          // Status = "responded"
	Closed             int                `json:"closed"`             // Status = "closed"
	ResponseRate       float64            `json:"responseRate"`       // (responded+closed)/total * 100
	AverageResponseTime string            `json:"averageResponseTime"` // "2.5 hours" or "N/A"
	RecentInquiries    []RecentInquiry    `json:"recentInquiries"`    // Last 5
	InquiryTrend       string             `json:"inquiryTrend"`       // "increasing", "stable", "decreasing"
}

// RecentInquiry represents a summary of a recent customer inquiry
type RecentInquiry struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Message   string    `json:"message"`    // Truncated to 100 chars
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// ============================================================================
// REVIEWS DATA (Customer Satisfaction Metrics)
// ============================================================================

// VendorReviews contains review-related metrics and rating breakdown
type VendorReviews struct {
	TotalReviews       int                 `json:"totalReviews"`
	ApprovedReviews    int                 `json:"approvedReviews"`
	PendingReviews     int                 `json:"pendingReviews"`
	AverageRating      float64             `json:"averageRating"`      // 0-5 scale
	RatingDistribution RatingDistribution  `json:"ratingDistribution"`
	RecentReviews      []RecentReview      `json:"recentReviews"`      // Last 5 approved
	SentimentTrend     string              `json:"sentimentTrend"`     // "improving", "stable", "declining"
}

// RatingDistribution shows count of each star rating
type RatingDistribution struct {
	FiveStar  int     `json:"fiveStar"`
	FourStar  int     `json:"fourStar"`
	ThreeStar int     `json:"threeStar"`
	TwoStar   int     `json:"twoStar"`
	OneStar   int     `json:"oneStar"`
	AvgRating float64 `json:"avgRating"` // Redundant but useful for frontend
}

// RecentReview represents a single review with key details
type RecentReview struct {
	ID         string    `json:"id"`
	Rating     int       `json:"rating"`
	Comment    string    `json:"comment"`    // Truncated to 150 chars
	UserName   string    `json:"userName"`
	IsApproved bool      `json:"isApproved"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ============================================================================
// TREND DATA (7-day & 30-day Performance)
// ============================================================================

// VendorTrends contains time-based performance metrics
type VendorTrends struct {
	Last7Days  PeriodMetrics `json:"last7Days"`
	Last30Days PeriodMetrics `json:"last30Days"`
}

// PeriodMetrics represents metrics for a specific time period
type PeriodMetrics struct {
	InquiryCount      int     `json:"inquiryCount"`
	NewReviews        int     `json:"newReviews"`
	AverageRating     float64 `json:"averageRating"`     // 0-5 scale
}

// ============================================================================
// PERFORMANCE INDICATORS (Account Health)
// ============================================================================

// VendorPerformance contains account status and verification details
type VendorPerformance struct {
    IsIdentityVerified   bool      `json:"isIdentityVerified"`
    IsBusinessVerified   bool      `json:"isBusinessVerified"`
    CACNumber            string    `json:"cacNumber"` // Show them their registered number
    DaysOnPlatform       int       `json:"daysOnPlatform"`
    LastProfileUpdate    time.Time `json:"lastProfileUpdate"`
    AccountStatus        string    `json:"accountStatus"`
    ProfileCompleteness  float64   `json:"profileCompleteness"`
    PVSScoreTrend        string    `json:"pvsScoreTrend"`
}


// ============================================================================
// INTERNAL DATA TRANSFER OBJECTS (Repository → Service)
// These are NOT returned to the client, only used internally
// ============================================================================


// InquiryMetricsRaw contains raw inquiry data from inquiries collection
type InquiryMetricsRaw struct {
	Total           int
	Pending         int
	Responded       int
	Closed          int
	RecentInquiries []RecentInquiry
}

// ReviewMetricsRaw contains raw review data from reviews collection
type ReviewMetricsRaw struct {
	TotalReviews    int
	AverageRating   float64
	RatingCounts    map[int]int // Map of rating -> count
	RecentReviews   []RecentReview
}

// PeriodInquiryData contains inquiry counts for a time period
type PeriodInquiryData struct {
	InquiryCount   int
	RespondedCount int
}

// PeriodReviewData contains review data for a time period
type PeriodReviewData struct {
	NewReviews    int
	AverageRating float64
}


// ============================================================================
// ERROR RESPONSES
// ============================================================================

// VendorAnalyticsError represents an error in analytics processing
type VendorAnalyticsError struct {
	Status  string `json:"status"`  // "error"
	Message string `json:"message"` // Human-readable error
	Code    string `json:"code"`    // Error code for client handling
}

// INTERNAL DATA TRANSFER OBJECT (Repository → Service)

// VendorAnalyticsData represents the complete analytics dataset
// Used internally between repository and service layers
type VendorAnalyticsData struct {
	// Base Info
	ID                 uuid.UUID `json:"id"`
	Name               string    `json:"name"`
	Category           string    `json:"category"`
	PvsScore           int       `json:"pvsScore"`
	ReviewCount        int       `json:"reviewCount"`
	IsIdentityVerified bool      `json:"isIdentityVerified"`
	CacNumber          string    `json:"cacNumber"`
	IsBusinessVerified bool      `json:"isBusinessVerified"`
	ProfileCompletion  int       `json:"profileCompletion"`
	InquiryCount       int       `json:"inquiryCount"`
	RespondedCount     int       `json:"respondedCount"`
	CreatedAt          string    `json:"createdAt"`
	UpdatedAt          string    `json:"updatedAt"`
	
	// Subscription
	Tier               string `json:"tier"`
	SubscriptionStatus string `json:"subscriptionStatus"`
	
	// Views
	ViewsTotal int `json:"viewsTotal"`
	Views30d   int `json:"views30d"`
	
	// Time-based Metrics (can be 0 for new vendors)
	Inquiries7d    int     `json:"inquiries7d"`
	Reviews7d      int     `json:"reviews7d"`
	AvgRating7d    float64 `json:"avgRating7d"`
	Inquiries30d   int     `json:"inquiries30d"`
	Reviews30d     int     `json:"reviews30d"`
	AvgRating30d   float64 `json:"avgRating30d"`
	TotalInquiries int     `json:"totalInquiries"`
	TotalReviews   int     `json:"totalReviews"`
	AvgRatingAll   float64 `json:"avgRatingAll"`
	
	// Rating Distribution (will be 0 for vendors with no reviews)
	FiveStar  int `json:"fiveStar"`
	FourStar  int `json:"fourStar"`
	ThreeStar int `json:"threeStar"`
	TwoStar   int `json:"twoStar"`
	OneStar   int `json:"oneStar"`
	
	// Recent Activity (can be empty arrays)
	RecentInquiries []RecentInquiry `json:"recentInquiries"`
	RecentReviews   []RecentReview  `json:"recentReviews"`
}