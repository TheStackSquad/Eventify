//backend/pkg/analytics/repository.go
 package analytics 

import (
	"context"
	"fmt"
	"time"

	"eventify/backend/pkg/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ============================================================================
// INTERFACE
// ============================================================================

// AnalyticsRepository defines methods for fetching analytics data
type AnalyticsRepository interface {
	// Event queries
	GetEventInfo(ctx context.Context, eventID primitive.ObjectID) (*models.EventBasicInfo, error)
	
	// Ticket queries
	GetTicketsSold(ctx context.Context, eventID string) (int64, error)
	GetTicketsSoldByTier(ctx context.Context, eventID string) (map[string]int64, error)
	
	// Order queries
	GetOrderMetrics(ctx context.Context, eventID string) (*models.OrderMetricsRaw, error)
	GetRevenueMetrics(ctx context.Context, eventID string) (*models.RevenueMetricsRaw, error)
	
	// Customer queries
	GetCustomerMetrics(ctx context.Context, eventID string) (*models.CustomerMetricsRaw, error)
	GetTopCountries(ctx context.Context, eventID string, limit int) ([]models.CountryData, error)
	
	// Payment queries
	GetPaymentChannels(ctx context.Context, eventID string) ([]models.PaymentChannelRaw, error)
	
	// Timeline queries (optional)
	GetSalesTimeline(ctx context.Context, eventID string, groupBy string) ([]models.TimelineData, error)
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

// MongoAnalyticsRepository implements AnalyticsRepository using MongoDB
type MongoAnalyticsRepository struct {
	EventCollection  *mongo.Collection
	OrderCollection  *mongo.Collection
	TicketCollection *mongo.Collection
}

// NewAnalyticsRepository creates a new analytics repository instance
func NewAnalyticsRepository(
	eventColl *mongo.Collection,
	orderColl *mongo.Collection,
	ticketColl *mongo.Collection,
) AnalyticsRepository {
	return &MongoAnalyticsRepository{
		EventCollection:  eventColl,
		OrderCollection:  orderColl,
		TicketCollection: ticketColl,
	}
}

// ============================================================================
// EVENT QUERIES
// ============================================================================

// GetEventInfo fetches basic event information
func (r *MongoAnalyticsRepository) GetEventInfo(
	ctx context.Context,
	eventID primitive.ObjectID,
) (*models.EventBasicInfo, error) {
	
	filter := bson.M{
		"_id":        eventID,
		"is_deleted": false,
	}

	var result struct {
		ID           primitive.ObjectID `bson:"_id"`
		Title        string             `bson:"event_title"`
		OrganizerID  primitive.ObjectID `bson:"organizer_id"`
		StartDate    time.Time          `bson:"start_date"`
		EndDate      time.Time          `bson:"end_date"`
		TicketTiers  []struct {
			TierName string  `bson:"tier_name"`
			Price    float64 `bson:"price"`      // In Naira
			Quantity int     `bson:"quantity"`
		} `bson:"ticket_tiers"`
	}

	err := r.EventCollection.FindOne(ctx, filter).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("event not found or deleted")
		}
		return nil, fmt.Errorf("failed to fetch event: %w", err)
	}

	// Convert to EventBasicInfo
	info := &models.EventBasicInfo{
		ID:          result.ID.Hex(),
		Title:       result.Title,
		OrganizerID: result.OrganizerID.Hex(),
		StartDate:   result.StartDate,
		EndDate:     result.EndDate,
		TicketTiers: make([]models.TierInfo, len(result.TicketTiers)),
	}

	for i, tier := range result.TicketTiers {
		info.TicketTiers[i] = models.TierInfo{
			TierName: tier.TierName,
			Price:    tier.Price,
			Quantity: tier.Quantity,
		}
	}

	return info, nil
}

// ============================================================================
// TICKET QUERIES
// ============================================================================

// GetTicketsSold counts total tickets sold for an event
func (r *MongoAnalyticsRepository) GetTicketsSold(
	ctx context.Context,
	eventID string, // STRING, not ObjectID
) (int64, error) {
	
	filter := bson.M{
		"event_id": eventID, // Match STRING field
	}

	count, err := r.TicketCollection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, fmt.Errorf("failed to count tickets: %w", err)
	}

	return count, nil
}

// GetTicketsSoldByTier returns tickets sold per tier
func (r *MongoAnalyticsRepository) GetTicketsSoldByTier(
	ctx context.Context,
	eventID string,
) (map[string]int64, error) {
	
	pipeline := mongo.Pipeline{
		// Match tickets for this event
		bson.D{{Key: "$match", Value: bson.M{
			"event_id": eventID,
		}}},
		
		// Group by tier and count
		bson.D{{Key: "$group", Value: bson.M{
			"_id":   "$tier_name",
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := r.TicketCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate tickets by tier: %w", err)
	}
	defer cursor.Close(ctx)

	result := make(map[string]int64)
	for cursor.Next(ctx) {
		var doc struct {
			TierName string `bson:"_id"`
			Count    int64  `bson:"count"`
		}
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		result[doc.TierName] = doc.Count
	}

	return result, nil
}

// ============================================================================
// ORDER QUERIES
// ============================================================================

// GetOrderMetrics fetches order status breakdown
func (r *MongoAnalyticsRepository) GetOrderMetrics(
	ctx context.Context,
	eventID string,
) (*models.OrderMetricsRaw, error) {
	
	pipeline := mongo.Pipeline{
		// Match orders containing this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID, // Match STRING in items array
		}}},
		
		// Group by status
		bson.D{{Key: "$group", Value: bson.M{
			"_id":   "$status",
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get order metrics: %w", err)
	}
	defer cursor.Close(ctx)

	metrics := &models.OrderMetricsRaw{}
	
	for cursor.Next(ctx) {
		var doc struct {
			Status string `bson:"_id"`
			Count  int    `bson:"count"`
		}
		if err := cursor.Decode(&doc); err != nil {
			continue
		}

		metrics.Total += doc.Count
		
		switch doc.Status {
		case "success":
			metrics.Successful = doc.Count
		case "pending":
			metrics.Pending = doc.Count
		case "failed":
			metrics.Failed = doc.Count
		case "fraud":
			metrics.Fraud = doc.Count
		}
	}

	return metrics, nil
}

// GetRevenueMetrics fetches financial data from successful orders
func (r *MongoAnalyticsRepository) GetRevenueMetrics(
	ctx context.Context,
	eventID string,
) (*models.RevenueMetricsRaw, error) {
	
	pipeline := mongo.Pipeline{
		// Match successful orders with this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
			"status":         "success",
		}}},
		
		// Group and sum financial fields
		bson.D{{Key: "$group", Value: bson.M{
			"_id":           nil,
			"totalRevenue":  bson.M{"$sum": "$final_total"},    // Total amount
			"subtotal":      bson.M{"$sum": "$subtotal"},       // Before fees
			"serviceFees":   bson.M{"$sum": "$service_fee"},
			"vat":           bson.M{"$sum": "$vat_amount"},
			"orderCount":    bson.M{"$sum": 1},
			"avgOrderValue": bson.M{"$avg": "$final_total"},
		}}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue metrics: %w", err)
	}
	defer cursor.Close(ctx)

	var result models.RevenueMetricsRaw
	
	if cursor.Next(ctx) {
		var doc struct {
			TotalRevenue    int     `bson:"totalRevenue"`
			Subtotal        int     `bson:"subtotal"`
			ServiceFees     int     `bson:"serviceFees"`
			VAT             int     `bson:"vat"`
			OrderCount      int     `bson:"orderCount"`
			AvgOrderValue   float64 `bson:"avgOrderValue"`
		}
		
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		
		result.TotalRevenue = doc.TotalRevenue
		result.SubtotalRevenue = doc.Subtotal
		result.ServiceFees = doc.ServiceFees
		result.VATAmount = doc.VAT
		result.OrderCount = doc.OrderCount
		result.TotalOrderValue = doc.AvgOrderValue
	}

	return &result, nil
}

// ============================================================================
// CUSTOMER QUERIES
// ============================================================================

// GetCustomerMetrics fetches unique customer count
func (r *MongoAnalyticsRepository) GetCustomerMetrics(
	ctx context.Context,
	eventID string,
) (*models.CustomerMetricsRaw, error) {
	
	pipeline := mongo.Pipeline{
		// Match successful orders with this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
			"status":         "success",
		}}},
		
		// Group and collect unique emails
		bson.D{{Key: "$group", Value: bson.M{
			"_id":          nil,
			"uniqueEmails": bson.M{"$addToSet": "$customer.email"},
			"totalOrders":  bson.M{"$sum": 1},
		}}},
		
		// Project to count emails
		bson.D{{Key: "$project", Value: bson.M{
			"uniqueEmails": 1,
			"totalOrders":  1,
		}}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer metrics: %w", err)
	}
	defer cursor.Close(ctx)

	var result models.CustomerMetricsRaw
	
	if cursor.Next(ctx) {
		var doc struct {
			UniqueEmails []string `bson:"uniqueEmails"`
			TotalOrders  int      `bson:"totalOrders"`
		}
		
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		
		result.UniqueEmails = doc.UniqueEmails
		result.TotalOrders = doc.TotalOrders
	}

	return &result, nil
}

// GetTopCountries fetches top countries by revenue
func (r *MongoAnalyticsRepository) GetTopCountries(
	ctx context.Context,
	eventID string,
	limit int,
) ([]models.CountryData, error) {
	
	pipeline := mongo.Pipeline{
		// Match successful orders with this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
			"status":         "success",
		}}},
		
		// Unwind items to get quantities
		bson.D{{Key: "$unwind", Value: "$items"}},
		
		// Filter to only items for this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
		}}},
		
		// Group by country
		bson.D{{Key: "$group", Value: bson.M{
			"_id":         "$customer.country",
			"orderCount":  bson.M{"$sum": 1},
			"revenue":     bson.M{"$sum": "$final_total"},
			"ticketsSold": bson.M{"$sum": "$items.quantity"},
		}}},
		
		// Sort by revenue (descending)
		bson.D{{Key: "$sort", Value: bson.M{"revenue": -1}}},
		
		// Limit results
		bson.D{{Key: "$limit", Value: limit}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get top countries: %w", err)
	}
	defer cursor.Close(ctx)

	var results []models.CountryData
	
	for cursor.Next(ctx) {
		var doc struct {
			Country     string `bson:"_id"`
			OrderCount  int    `bson:"orderCount"`
			Revenue     int    `bson:"revenue"`
			TicketsSold int    `bson:"ticketsSold"`
		}
		
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		
		results = append(results, models.CountryData{
			Country:     doc.Country,
			OrderCount:  doc.OrderCount,
			TicketsSold: doc.TicketsSold,
			Revenue:     doc.Revenue,
			// PercentOfTotal will be calculated in service layer
		})
	}

	return results, nil
}

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

// GetPaymentChannels fetches payment method breakdown
func (r *MongoAnalyticsRepository) GetPaymentChannels(
	ctx context.Context,
	eventID string,
) ([]models.PaymentChannelRaw, error) {
	
	pipeline := mongo.Pipeline{
		// Match orders with this event that have payment channel
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id":    eventID,
			"payment_channel":   bson.M{"$exists": true, "$ne": ""},
		}}},
		
		// Group by payment channel
		bson.D{{Key: "$group", Value: bson.M{
			"_id":      "$payment_channel",
			"orderCount": bson.M{"$sum": 1},
			"revenue": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$eq": bson.A{"$status", "success"}},
					"$final_total",
					0,
				},
			}},
			"successCount": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$eq": bson.A{"$status", "success"}},
					1,
					0,
				},
			}},
			"failCount": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$eq": bson.A{"$status", "failed"}},
					1,
					0,
				},
			}},
		}}},
		
		// Sort by revenue
		bson.D{{Key: "$sort", Value: bson.M{"revenue": -1}}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment channels: %w", err)
	}
	defer cursor.Close(ctx)

	var results []models.PaymentChannelRaw
	
	for cursor.Next(ctx) {
		var doc struct {
			Channel      string `bson:"_id"`
			OrderCount   int    `bson:"orderCount"`
			Revenue      int    `bson:"revenue"`
			SuccessCount int    `bson:"successCount"`
			FailCount    int    `bson:"failCount"`
		}
		
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		
		results = append(results, models.PaymentChannelRaw{
			Channel:      doc.Channel,
			OrderCount:   doc.OrderCount,
			Revenue:      doc.Revenue,
			SuccessCount: doc.SuccessCount,
			FailCount:    doc.FailCount,
		})
	}

	return results, nil
}

// ============================================================================
// TIMELINE QUERIES (Optional)
// ============================================================================

// GetSalesTimeline fetches sales data grouped by time period
func (r *MongoAnalyticsRepository) GetSalesTimeline(
	ctx context.Context,
	eventID string,
	groupBy string, // "day", "week", "month"
) ([]models.TimelineData, error) {
	
	// Determine date format based on grouping
	dateFormat := "%Y-%m-%d" // daily
	if groupBy == "week" {
		dateFormat = "%Y-W%V"
	} else if groupBy == "month" {
		dateFormat = "%Y-%m"
	}

	pipeline := mongo.Pipeline{
		// Match successful orders with this event
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
			"status":         "success",
			"paid_at":        bson.M{"$exists": true},
		}}},
		
		// Unwind items
		bson.D{{Key: "$unwind", Value: "$items"}},
		
		// Filter to this event's items
		bson.D{{Key: "$match", Value: bson.M{
			"items.event_id": eventID,
		}}},
		
		// Group by date
		bson.D{{Key: "$group", Value: bson.M{
			"_id": bson.M{"$dateToString": bson.M{
				"format": dateFormat,
				"date":   "$paid_at",
			}},
			"ticketsSold": bson.M{"$sum": "$items.quantity"},
			"revenue":     bson.M{"$sum": "$items.subtotal"},
			"orderCount":  bson.M{"$sum": 1},
		}}},
		
		// Sort by date
		bson.D{{Key: "$sort", Value: bson.M{"_id": 1}}},
	}

	cursor, err := r.OrderCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get sales timeline: %w", err)
	}
	defer cursor.Close(ctx)

	var results []models.TimelineData
	
	for cursor.Next(ctx) {
		var doc struct {
			Date        string `bson:"_id"`
			TicketsSold int    `bson:"ticketsSold"`
			Revenue     int    `bson:"revenue"`
			OrderCount  int    `bson:"orderCount"`
		}
		
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		
		results = append(results, models.TimelineData{
			Date:        doc.Date,
			TicketsSold: doc.TicketsSold,
			Revenue:     doc.Revenue,
			OrderCount:  doc.OrderCount,
			// CumulativeSold will be calculated in service layer
		})
	}

	return results, nil
}