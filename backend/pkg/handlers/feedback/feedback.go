// backend/pkg/handlers/feedback/feedback.go
// Feedback handler - main struct and constructor

package feedback

import (
	servicefeedback "github.com/eventify/backend/pkg/services/feedback"
)

type FeedbackHandler struct {
	service servicefeedback.FeedbackService
}

func NewFeedbackHandler(service servicefeedback.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{
		service: service,
	}
}