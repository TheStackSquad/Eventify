//backend/ pkg/testhelper/db.go
package testhelper

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// NewTestDB returns a connected *sqlx.DB pointed at Eventify_test.
// It loads .env.test from the repo root, registers cleanup, and fails fast
// if the connection cannot be established.
func NewTestDB(t *testing.T) *sqlx.DB {
	t.Helper()

	// Walk up from this file to find the repo root where .env.test lives.
	_, thisFile, _, _ := runtime.Caller(0)
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..")
	_ = godotenv.Load(filepath.Join(repoRoot, ".env.test"))

	dsn := os.Getenv("POSTGRES_TEST_URI")
	if dsn == "" {
		dsn = "postgres://astronautdesh:astronautdesh@localhost:5432/Eventify_test?sslmode=disable"
	}

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("testhelper: cannot connect to test DB: %v\n"+
			"Ensure Eventify_test is running and POSTGRES_TEST_URI is set.", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	t.Cleanup(func() { _ = db.Close() })

	return db
}

// TruncateTables removes all rows from the given tables using TRUNCATE CASCADE,
// which handles FK RESTRICT constraints (e.g. events → users) automatically.
// Use this in TearDownTest / t.Cleanup to leave the DB clean between runs.
func TruncateTables(t *testing.T, db *sqlx.DB, tables ...string) {
	t.Helper()
	for _, tbl := range tables {
		_, err := db.Exec(fmt.Sprintf("TRUNCATE TABLE %s CASCADE", tbl))
		if err != nil {
			t.Logf("testhelper: warning — could not truncate table %q: %v", tbl, err)
		}
	}
}

// RefreshAnalyticsViews refreshes both materialized views used in analytics
// and leaderboard queries. Call this after seeding data in integration tests.
func RefreshAnalyticsViews(t *testing.T, db *sqlx.DB) {
	t.Helper()
	views := []string{
		"REFRESH MATERIALIZED VIEW vendor_daily_metrics",
		"REFRESH MATERIALIZED VIEW vendor_of_the_month",
	}
	for _, q := range views {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("testhelper: failed to refresh view — %s: %v", q, err)
		}
	}
}