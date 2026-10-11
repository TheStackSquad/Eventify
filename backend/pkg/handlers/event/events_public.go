// backend/pkg/handlers/events_public.go

package event

import (
	"context"
	"net/http"
	"strconv"
	"time"
	"strings"

	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	"github.com/eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)


// ============================================================================
// PUBLIC EVENT HANDLERS
// ============================================================================

func (h *EventHandler) GetAllEvents(c *gin.Context) {
	filters := repoevent.EventFilters{IsDeleted: false}

	if eventType := c.Query("eventType"); eventType != "" {
		et := models.EventType(eventType)
		filters.EventType = &et
	}
	if category := c.Query("category"); category != "" {
		filters.Category = &category
	}
	if city := c.Query("city"); city != "" {
		filters.City = &city
	}
	if startDate := c.Query("startDate"); startDate != "" {
		if t, err := time.Parse(time.RFC3339, startDate); err == nil {
			filters.StartDate = &t
		}
	}
	if endDate := c.Query("endDate"); endDate != "" {
		if t, err := time.Parse(time.RFC3339, endDate); err == nil {
			filters.EndDate = &t
		}
	}
	if limit := c.Query("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			filters.Limit = l
		}
	} else {
		filters.Limit = 50
	}
	if offset := c.Query("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			filters.Offset = o
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := h.eventService.GetAllEvents(ctx, filters)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch public events")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch events"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": result.Events,
		"total":  result.Total,
	})
}

func (h *EventHandler) SearchEvents(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Search query is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	filters := repoevent.EventFilters{
		IsDeleted:  false,
		Limit:      10,
		SearchTerm: &query,
	}

	result, err := h.eventService.GetAllEvents(ctx, filters)
	if err != nil {
		log.Error().Err(err).Str("query", query).Msg("Search query failed")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Search failed"})
		return
	}

	// AI suggestions are only computed on the miss path — zero DB results
	var aiSuggestions []string
	if len(result.Events) == 0 {
		aiSuggestions = generateAISuggestions(query)
	}

	c.JSON(http.StatusOK, gin.H{
		"dbResults":     result.Events,
		"aiSuggestions": aiSuggestions,
	})
}

func (h *EventHandler) GetPublicEventByID(c *gin.Context) {
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	event, err := h.eventService.GetEventByID(ctx, eventID, nil)
	if err != nil {
		log.Error().Err(err).Str("event_id", eventID.String()).Msg("Failed to fetch event")
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}

	c.JSON(http.StatusOK, event)
}

// ============================================================================
// AI SUGGESTIONS
// Keyword-based fallback — only called when search returns zero DB results.
// Scores the query against per-category keyword lists and returns the best
// matching category's suggestion templates. Falls back to generic Lagos
// event suggestions when no category is confidently matched.
// ============================================================================

// categoryKeywords maps each platform category to the terms a user might
// type when searching for that category. All terms are lowercase — matching
// is case-insensitive via strings.ToLower on the incoming query.
var categoryKeywords = map[string][]string{
	"Music & concerts": {
		"music", "concert", "live", "band", "dj", "afrobeats", "afropop",
		"highlife", "gospel music", "rap", "hiphop", "hip hop", "rnb", "r&b",
		"reggae", "jazz", "singer", "performer", "show", "gig", "festival",
	},
	"Food & drink": {
		"food", "drink", "drinks", "eat", "eating", "restaurant", "dinner",
		"lunch", "brunch", "breakfast", "cocktail", "wine", "beer", "tasting",
		"chef", "cooking", "cuisine", "supper", "feast", "culinary", "grill",
		"bbq", "barbecue", "pop-up", "foodie",
	},
	"Arts & culture": {
		"art", "arts", "culture", "cultural", "exhibition", "gallery",
		"museum", "theatre", "theater", "play", "drama", "dance", "poetry",
		"spoken word", "film", "movie", "screening", "photography", "craft",
		"creative", "performance", "heritage", "installation",
	},
	"Tech & business": {
		"tech", "technology", "startup", "business", "entrepreneur",
		"networking", "network", "meetup", "conference", "summit", "hackathon",
		"coding", "developer", "fintech", "ai", "innovation", "pitch",
		"investment", "investors", "product", "saas", "web3", "crypto",
		"blockchain", "seminar",
	},
	"Fashion & lifestyle": {
		"fashion", "style", "lifestyle", "runway", "designer", "clothing",
		"beauty", "makeup", "skincare", "wellness", "spa", "luxury",
		"brand", "shopping", "trends", "outfit", "wardrobe", "model",
		"photoshoot", "influencer",
	},
	"Education & workshops": {
		"education", "workshop", "learn", "learning", "course", "class",
		"training", "webinar", "skill", "skills", "bootcamp", "coaching",
		"mentorship", "career", "professional", "certification", "talk",
		"lecture", "panel", "masterclass",
	},
	"Religion & community": {
		"church", "mosque", "prayer", "worship", "faith", "gospel",
		"religious", "religion", "spiritual", "community", "charity",
		"volunteer", "outreach", "crusade", "revival", "convention",
		"youth", "fellowship", "celebration",
	},
}

// suggestionTemplates holds the ready-to-display suggestion strings for each
// category. Returned directly when a category match is found.
var suggestionTemplates = map[string][]string{
	"Music & concerts": {
		"Afrobeats concerts in Lagos",
		"Live music shows this weekend",
		"Gospel music concerts near you",
		"DJ sets and nightlife events",
	},
	"Food & drink": {
		"Food festivals in Lagos",
		"Wine and cocktail tasting events",
		"Pop-up dining experiences",
		"Culinary workshops and cooking classes",
	},
	"Arts & culture": {
		"Art exhibitions and gallery openings",
		"Theatre and drama performances",
		"Cultural festivals in Lagos",
		"Photography and creative showcases",
	},
	"Tech & business": {
		"Tech meetups and startup events",
		"Business networking in Lagos",
		"Hackathons and coding competitions",
		"Investment and entrepreneurship summits",
	},
	"Fashion & lifestyle": {
		"Fashion shows and runway events",
		"Beauty and wellness experiences",
		"Lifestyle and luxury brand events",
		"Style and designer pop-ups",
	},
	"Education & workshops": {
		"Skill-building workshops in Lagos",
		"Professional development seminars",
		"Masterclasses and coaching sessions",
		"Career and certification programmes",
	},
	"Religion & community": {
		"Church conventions and revivals",
		"Community outreach and charity events",
		"Youth fellowship gatherings",
		"Faith and worship conferences",
	},
}

func generateAISuggestions(query string) []string {
	lower := strings.ToLower(strings.TrimSpace(query))
	words := strings.Fields(lower)
	matchScores := make(map[string]int, len(categoryKeywords))

	for category, keywords := range categoryKeywords {
		for _, keyword := range keywords {
			if strings.Contains(lower, keyword) {
				// Multi-word keywords are a stronger signal
				if strings.Contains(keyword, " ") {
					matchScores[category] += 2
				} else {
					matchScores[category]++
				}
			}
		}
		// Exact word-boundary matches score an extra point
		for _, word := range words {
			for _, keyword := range keywords {
				if word == keyword {
					matchScores[category]++
				}
			}
		}
	}

	bestCategory := ""
	bestScore := 0
	for category, score := range matchScores {
		if score > bestScore {
			bestScore = score
			bestCategory = category
		}
	}

	if bestScore > 0 && bestCategory != "" {
		log.Debug().
			Str("query", query).
			Str("matched_category", bestCategory).
			Int("score", bestScore).
			Msg("AI suggestions: category matched")
		return suggestionTemplates[bestCategory]
	}

	log.Debug().
		Str("query", query).
		Msg("AI suggestions: no category match, using generic fallback")

	return []string{
		"Popular events in Lagos this weekend",
		"Free events happening near you",
		"Top-rated events in Lagos",
		"New events added this week",
	}
}

func GenerateAISuggestions(query string) []string {
	// simple intelligent fallback (can evolve later)

	suggestions := []string{
		"Live music events in Lagos",
		"Tech meetups near you",
		"Afrobeats concerts",
		"Business networking events",
	}

	return suggestions
}

