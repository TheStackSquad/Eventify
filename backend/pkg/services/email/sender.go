//backend/pkg/services/email/sender.go

package email

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Sender delivers one email. Implementations must honour ctx and never log message bodies.
type Sender interface {
	Send(ctx context.Context, to, subject, body string) error
}

// permanentError marks failures that can never succeed on retry (bad address, unknown template).
type permanentError struct{ err error }

func (e permanentError) Error() string { return e.err.Error() }
func (e permanentError) Unwrap() error { return e.err }

func isPermanent(err error) bool {
	var pe permanentError
	return errors.As(err, &pe)
}

// NewSenderFromEnv uses the variables password-reset mail already reads.
// In release mode a missing SMTP_HOST is an error: marking mail "sent" without sending it would lose it silently.
func NewSenderFromEnv() (Sender, error) {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		if os.Getenv("GIN_MODE") == "release" {
			return nil, errors.New("SMTP_HOST is not set")
		}
		log.Warn().Msg("SMTP_HOST not set: emails are logged (recipient and subject only), not delivered")
		return logSender{}, nil
	}
	from, err := mail.ParseAddress(os.Getenv("FROM_EMAIL"))
	if err != nil {
		return nil, fmt.Errorf("FROM_EMAIL is invalid: %w", err)
	}
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = "587"
	}
	return &SMTPSender{host: host, port: port, user: os.Getenv("SMTP_USER"), pass: os.Getenv("SMTP_PASS"), from: *from}, nil
}

type logSender struct{}

func (logSender) Send(_ context.Context, to, subject, _ string) error {
	log.Info().Str("to", to).Str("subject", subject).Msg("[DEV EMAIL] not delivered")
	return nil
}

type SMTPSender struct {
	host, port, user, pass string
	from                   mail.Address
}

func (s *SMTPSender) Send(ctx context.Context, to, subject, body string) error {
	rcpt, err := mail.ParseAddress(strings.TrimSpace(to))
	if err != nil {
		return permanentError{fmt.Errorf("invalid recipient: %w", err)}
	}
	msg, err := s.buildMessage(rcpt.Address, subject, body)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	d := net.Dialer{Timeout: 10 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(s.host, s.port))
	if err != nil {
		return err
	}
	if dl, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(dl)
	}
	if s.port == "465" { // implicit TLS
		conn = tls.Client(conn, &tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12})
	}
	c, err := smtp.NewClient(conn, s.host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer c.Close()

	if s.port != "465" {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}); err != nil {
				return err
			}
		}
	}
	if s.user != "" { // PlainAuth refuses to send credentials over an unencrypted link
		if err := c.Auth(smtp.PlainAuth("", s.user, s.pass, s.host)); err != nil {
			return err
		}
	}
	if err := c.Mail(s.from.Address); err != nil {
		return err
	}
	if err := c.Rcpt(rcpt.Address); err != nil {
		var tp *textproto.Error
		if errors.As(err, &tp) && tp.Code >= 500 { // this address will never work
			return permanentError{err}
		}
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

func (s *SMTPSender) buildMessage(to, subject, body string) ([]byte, error) {
	var id [12]byte
	if _, err := rand.Read(id[:]); err != nil {
		return nil, err
	}
	domain := "localhost"
	if i := strings.LastIndex(s.from.Address, "@"); i >= 0 {
		domain = s.from.Address[i+1:]
	}
	subject = strings.NewReplacer("\r", "", "\n", "").Replace(subject)

	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", s.from.String())
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", subject))
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	fmt.Fprintf(&b, "Message-ID: <%s@%s>\r\n", hex.EncodeToString(id[:]), domain)
	b.WriteString("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n")
	qp := quotedprintable.NewWriter(&b)
	if _, err := qp.Write([]byte(body)); err != nil {
		return nil, err
	}
	if err := qp.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}