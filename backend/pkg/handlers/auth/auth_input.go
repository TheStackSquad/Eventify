// backend/pkg/handlers/auth/auth_input.go

package auth

import (
    "strings"

    "github.com/gin-gonic/gin"
)

// maxPasswordBytes is the most bcrypt can use. Longer passwords are refused instead of failing or being cut (F418).
const maxPasswordBytes = 72

// signupInput holds only the fields a sign-up may set. Binding straight into models.User let a caller choose the id (F417).
type signupInput struct {
    Name     string `json:"name"     binding:"required"`
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required,min=6"`
}

// bearerToken returns the token of an "Authorization: Bearer <token>" header, or "" (the rule AuthMiddleware uses).
func bearerToken(c *gin.Context) string {
    parts := strings.Fields(c.GetHeader("Authorization"))
    if len(parts) == 2 && parts[0] == "Bearer" {
        return strings.TrimSpace(parts[1])
    }
    return ""
}
