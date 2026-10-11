//backend/pkg/db/db.go

package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
)

var PostgresClient *sqlx.DB

func Initialize() {
	if err := godotenv.Load(".env"); err != nil {
		log.Println("Warning: Could not load .env file. Assuming environment variables are set externally.")
	}
}

func ConnectDB() {
	Initialize()

	pgURI := os.Getenv("POSTGRES_URI")
	if pgURI == "" {
		log.Fatal("FATAL: POSTGRES_URI environment variable is not set. Check your backend/.env file.")
	}

	var err error
	PostgresClient, err = sqlx.Connect("pgx", pgURI)
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to PostgreSQL using sqlx: %v", err)
	}

	PostgresClient.SetMaxOpenConns(25)
	PostgresClient.SetMaxIdleConns(10)
	PostgresClient.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = PostgresClient.PingContext(ctx); err != nil {
		log.Fatalf("FATAL: Failed to ping PostgreSQL. Ensure the service is running and URI is correct: %v", err)
	}

	log.Printf("SUCCESS: Connected to PostgreSQL using sqlx.")
}

func GetDB() *sqlx.DB {
	if PostgresClient == nil {
		log.Fatal("FATAL: PostgreSQL Client is not initialized. Call ConnectDB first.")
	}
	return PostgresClient
}

func CloseDB() {
	if PostgresClient != nil {
		if err := PostgresClient.Close(); err != nil {
			log.Printf("Warning: Error closing PostgreSQL connection: %v", err)
		} else {
			fmt.Println("INFO: Disconnected from PostgreSQL.")
		}
	}
}
