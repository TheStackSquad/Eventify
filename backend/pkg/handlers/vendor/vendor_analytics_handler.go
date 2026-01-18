// backend/pkg/handlers/vendor_analytics_handler.go

package handlers

import (
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
)

type VendorAnalyticsHandler struct {
	analyticsService servicevendor.VendorAnalyticsService
}

func NewVendorAnalyticsHandler(analyticsService servicevendor.VendorAnalyticsService) *VendorAnalyticsHandler {
	return &VendorAnalyticsHandler{
		analyticsService: analyticsService,
	}
}