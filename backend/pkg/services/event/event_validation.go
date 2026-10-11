// backend/pkg/services/event/event_validation.go

package event

import (
	"errors"
	"time"
	"github.com/eventify/backend/pkg/models"
)

func (s *eventService) validateEvent(event *models.Event) error {
	if event.EventTitle == "" {
		return errors.New("event title is required")
	}

	if event.EventDescription == "" {
		return errors.New("event description is required")
	}

	if event.StartDate.After(event.EndDate) {
		return errors.New("start date must be before end date")
	}

	if event.StartDate.Before(time.Now()) {
		return errors.New("start date must be in the future")
	}

	// Physical event check
	if event.EventType == models.TypePhysical {
		if event.VenueName == nil || *event.VenueName == "" {
			return errors.New("venue name is required for physical events")
		}
	}

	// Virtual event check
	if event.EventType == models.TypeVirtual {
		if event.MeetingLink == nil || *event.MeetingLink == "" {
			return errors.New("meeting link is required for virtual events")
		}
	}

	return nil
}