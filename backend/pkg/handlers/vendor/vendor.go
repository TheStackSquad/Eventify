// backend/pkg/handlers/vendor/vendor.go
// Vendor handler - struct definitions and constructor

package handlers

import (
	servicevendor "eventify/backend/pkg/services/vendor"
)

type VendorHandler struct {
	VendorService servicevendor.VendorService
}

type VendorBinding struct {
    // All these fields now have the binding:"required" tag
    Name          string   `json:"name" binding:"required"`
    Category      string   `json:"category" binding:"required"`
    ImageURL      string   `json:"imageURL" binding:"required"`
    State         string   `json:"state" binding:"required"`
    City          string   `json:"city" binding:"required"`
    PhoneNumber   string   `json:"phoneNumber" binding:"required"`
    
    // minPrice remains optional (no required tag)
    MinPrice      int32    `json:"minPrice"`
}

func NewVendorHandler(vendorService  servicevendor.VendorService) *VendorHandler {
	return &VendorHandler{VendorService: vendorService}
}