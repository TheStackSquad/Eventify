// backend/pkg/repository/auth/auth_errors.go

package auth

import "errors"

// ErrEmailTaken is returned by CreateUser when the email is already registered (F412).
var ErrEmailTaken = errors.New("user with this email already exists")

// ErrUserNotFound is returned when a lookup finds no user (F420).
var ErrUserNotFound = errors.New("user not found")

// isUniqueViolation reports whether err is a Postgres unique-constraint violation (SQLSTATE 23505).
// It works for pgx and lib/pq errors, because both expose SQLState().
func isUniqueViolation(err error) bool {
    var st interface{ SQLState() string }
    return errors.As(err, &st) && st.SQLState() == "23505"
}
