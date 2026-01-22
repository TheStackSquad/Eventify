// backend/pkg/utils/email.go

package utils

import (
	"fmt"
	"net/smtp"
	"os"
	"time"
	"github.com/rs/zerolog/log"
)

func SendPasswordResetEmail(to, name, resetLink string) error {
	// Email configuration from environment
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	fromEmail := os.Getenv("FROM_EMAIL")
	
	if smtpHost == "" {
		return fmt.Errorf("SMTP not configured")
	}
	
	// Email content
	subject := "Password Reset Request - Eventify"
	body := fmt.Sprintf(`
		Hello %s,
		
		You requested to reset your password. Click the link below to reset it:
		
		%s
		
		This link will expire in 15 minutes.
		
		If you didn't request this, please ignore this email.
		
		Best regards,
		Eventify Team
	`, name, resetLink)
	
	message := []byte(fmt.Sprintf(
		"Subject: %s\r\n\r\n%s", 
		subject, 
		body,
	))
	
	// Send email
	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	err := smtp.SendMail(
		smtpHost+":"+smtpPort,
		auth,
		fromEmail,
		[]string{to},
		message,
	)
	
	return err
}

func MockSendEmail(to string, subject string, body string) error {
	// 1. Log to console for immediate visibility
	log.Info().
		Str("to", to).
		Str("subject", subject).
		Msg("📧 [MOCK EMAIL SENT]")

	// 2. Write to a local file (email_debug.log) so you can review the content
	content := fmt.Sprintf("\n--- %s ---\nTo: %s\nSubject: %s\nBody: %s\n-------------------\n", 
		time.Now().Format(time.RFC822), to, subject, body)

	f, err := os.OpenFile("email_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.WriteString(content); err != nil {
		return err
	}

	return nil
}