// backend/pkg/models/vendor_analytics.go

package models

import "time"

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
	Insights    []ActionableInsight `json:"insights"` // Key recommendations
}

// ============================================================================
// OVERVIEW DATA (Top-level KPIs)
// ============================================================================

// VendorOverview contains high-level metrics for dashboard stat cards
type VendorOverview struct {
	CurrentPVSScore      int     `json:"currentPvsScore"`
	TotalInquiries       int     `json:"totalInquiries"`
	TotalResponded       int     `json:"totalResponded"`
	ResponseRate         float64 `json:"responseRate"`         // %
	TotalBookings        int     `json:"totalBookings"`
	ProfileCompletion    float64 `json:"profileCompletion"`    // %
	AverageRating        float64 `json:"averageRating"`        // 0-5 scale
	TotalReviews         int     `json:"totalReviews"`
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
	RespondedCount    int     `json:"respondedCount"`
	ResponseRate      float64 `json:"responseRate"`      // %
	NewReviews        int     `json:"newReviews"`
	AverageRating     float64 `json:"averageRating"`     // 0-5 scale
//	BookingsCompleted int     `json:"bookingsCompleted"` // If tracked separately
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
// ACTIONABLE INSIGHTS (AI-like Recommendations)
// ============================================================================

// ActionableInsight provides specific recommendations to vendors
type ActionableInsight struct {
	Type        string `json:"type"`        // "critical", "warning", "tip", "success"
	Title       string `json:"title"`       // "Respond to 3 pending inquiries"
	Description string `json:"description"` // Detailed explanation
	Action      string `json:"action"`      // "Go to inquiries page"
	Priority    int    `json:"priority"`    // 1=high, 2=medium, 3=low
}

// ============================================================================
// INTERNAL DATA TRANSFER OBJECTS (Repository → Service)
// These are NOT returned to the client, only used internally
// ============================================================================

// VendorBasicInfo contains vendor details from vendors collection
type VendorBasicInfo struct {
    ID                 string    `db:"id"`
    Name               string    `db:"name"`
    Category           string    `db:"category"`
    PVSScore           int       `db:"pvs_score"`
    ReviewCount        int       `db:"review_count"`
    IsIdentityVerified bool      `db:"is_identity_verified"`
    CACNumber          string    `db:"cac_number"`           // NEW
    IsBusinessVerified bool      `db:"is_business_verified"` // NEW
    ProfileCompletion  float32   `db:"profile_completion"`
    InquiryCount       int       `db:"inquiry_count"`
    RespondedCount     int       `db:"responded_count"`
    CreatedAt          time.Time `db:"created_at"`
    UpdatedAt          time.Time `db:"updated_at"`
}
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
	ApprovedReviews int
	PendingReviews  int
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
// QUERY PARAMETERS (for filtering)
// ============================================================================

// VendorAnalyticsQuery represents optional query parameters
type VendorAnalyticsQuery struct {
	IncludeInsights bool // Whether to generate actionable insights
	Period          string // "7d", "30d", "90d" for trend analysis
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