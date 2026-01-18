// backend/pkg/handlers/vendor/vendor.go

package handlers

import (
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
)

type VendorHandler struct {
	VendorService servicevendor.VendorService
}

func NewVendorHandler(vendorService servicevendor.VendorService) *VendorHandler {
	return &VendorHandler{VendorService: vendorService}
}