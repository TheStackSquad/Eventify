// backend/pkg/handlers/vendor/vendor.go

package vendor

import (
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
)

type VendorHandler struct {
	VendorService servicevendor.VendorService
	StatsRepo     repovendor.VendorPublicStatsRepository
}

func NewVendorHandler(vendorService servicevendor.VendorService, statsRepo repovendor.VendorPublicStatsRepository) *VendorHandler {
	return &VendorHandler{VendorService: vendorService, StatsRepo: statsRepo}
}