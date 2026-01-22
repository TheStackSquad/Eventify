//backend/pkg/handlers/event/ticket_handler.go

package event

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// CheckIn handles the gate scan request
func (h *EventHandler) CheckIn(c *gin.Context) {
    var req struct {
        Code string `json:"code" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Valid ticket code required"})
        return
    }

    // Call the service we built earlier
    err := h.eventService.ValidateAndCheckInTicket(c.Request.Context(), req.Code)
    if err != nil {
        // Handle specifically for Nigeria: clear error messages for the staff
        c.JSON(http.StatusConflict, gin.H{
            "status":  "denied",
            "message": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "status":  "granted",
        "message": "Verified! Welcome to the event.",
    })
}