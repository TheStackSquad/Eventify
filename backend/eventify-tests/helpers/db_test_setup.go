package shared

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

var TestDB *sqlx.DB

// TestContext wraps a test with database transaction rollback
type TestContext struct {
	DB *sqlx.DB
	Tx *sqlx.Tx
	T  *testing.T
}

// InitTestDB initializes the test database connection
func InitTestDB() error {
	// Load test environment variables
	if err := godotenv.Load("../.env.test"); err != nil {
		// Try loading from backend directory
		if err := godotenv.Load("../../.env"); err != nil {
			log.Println("Warning: Could not load .env file, using system environment variables")
		}
	}

	pgURI := os.Getenv("POSTGRES_URI")
	if pgURI == "" {
		return fmt.Errorf("POSTGRES_URI environment variable is not set")
	}

	var err error
	TestDB, err = sqlx.Connect("pgx", pgURI)
	if err != nil {
		return fmt.Errorf("failed to connect to test database: %w", err)
	}

	// Configure connection pool for testing
	TestDB.SetMaxOpenConns(10)
	TestDB.SetMaxIdleConns(5)
	TestDB.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = TestDB.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping test database: %w", err)
	}

	log.Println("✅ Test database connected successfully")
	return nil
}

// CloseTestDB closes the test database connection
func CloseTestDB() {
	if TestDB != nil {
		if err := TestDB.Close(); err != nil {
			log.Printf("Warning: Error closing test database: %v", err)
		}
	}
}

// BeginTestTx starts a test transaction that will be rolled back
func BeginTestTx(t *testing.T) *TestContext {
	tx, err := TestDB.BeginTxx(context.Background(), &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	})
	if err != nil {
		t.Fatalf("Failed to begin test transaction: %v", err)
	}

	return &TestContext{
		DB: TestDB,
		Tx: tx,
		T:  t,
	}
}

// Rollback rolls back the test transaction
func (tc *TestContext) Rollback() {
	if err := tc.Tx.Rollback(); err != nil && err != sql.ErrTxDone {
		tc.T.Logf("Warning: Failed to rollback test transaction: %v", err)
	}
}

// Commit commits the test transaction (use sparingly)
func (tc *TestContext) Commit() {
	if err := tc.Tx.Commit(); err != nil {
		tc.T.Fatalf("Failed to commit test transaction: %v", err)
	}
}

// CleanupTestData removes test data from specific tables
func CleanupTestData(ctx context.Context, tables ...string) error {
	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s WHERE event_title LIKE 'TEST_%%' OR event_title LIKE '%%_TEST'", table)
		if _, err := TestDB.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("failed to cleanup %s: %w", table, err)
		}
	}
	return nil
}

// TruncateTestTables truncates tables for a fresh test run (USE WITH CAUTION)
func TruncateTestTables(ctx context.Context, tables ...string) error {
	for _, table := range tables {
		query := fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table)
		if _, err := TestDB.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("failed to truncate %s: %w", table, err)
		}
	}
	return nil
}

// WaitForCondition polls until a condition is met or timeout
func WaitForCondition(t *testing.T, timeout time.Duration, interval time.Duration, condition func() bool) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return true
		}
		time.Sleep(interval)
	}
	return false
}