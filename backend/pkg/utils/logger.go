// backend/pkg/utils/logger.go
package utils

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Log levels for different environments
const (
	LogLevelDebug   = "debug"
	LogLevelInfo    = "info"
	LogLevelWarning = "warn"
	LogLevelError   = "error"
)

// InitLogger configures structured logging for the application
func InitLogger() zerolog.Logger {
	// Determine log level from environment
	logLevel := getLogLevel()
	zerolog.SetGlobalLevel(logLevel)

	// Configure output format
	logger := zerolog.New(createLogWriter()).With().Timestamp().Logger()

	// Set as global logger
	log.Logger = logger

	return logger
}

func getLogLevel() zerolog.Level {
	levelStr := os.Getenv("LOG_LEVEL")
	switch levelStr {
	case LogLevelDebug:
		return zerolog.DebugLevel
	case LogLevelInfo:
		return zerolog.InfoLevel
	case LogLevelWarning:
		return zerolog.WarnLevel
	case LogLevelError:
		return zerolog.ErrorLevel
	default:
		// Default based on environment
		if os.Getenv("GIN_MODE") == "release" {
			return zerolog.InfoLevel
		}
		return zerolog.DebugLevel
	}
}

func createLogWriter() zerolog.ConsoleWriter {
	writer := zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
		FormatLevel: func(i interface{}) string {
			var level string
			if ll, ok := i.(string); ok {
				switch ll {
				case "debug":
					level = "🐛 DBG"
				case "info":
					level = "ℹ️  INF"
				case "warn":
					level = "⚠️  WRN"
				case "error":
					level = "❌ ERR"
				case "fatal":
					level = "💀 FTL"
				case "panic":
					level = "🚨 PAN"
				default:
					level = ll
				}
			}
			return level
		},
		FormatMessage: func(i interface{}) string {
			if msg, ok := i.(string); ok {
				return msg
			}
			return ""
		},
		FormatFieldName: func(i interface{}) string {
			return ""
		},
		FormatFieldValue: func(i interface{}) string {
			return ""
		},
	}

	return writer
}

// Smart logging functions with context
func LogInfo(service, operation, message string, fields ...interface{}) {
	log.Info().
		Str("service", service).
		Str("operation", operation).
		Msgf(message, fields...)
}

func LogSuccess(service, operation, message string, fields ...interface{}) {
	log.Info().
		Str("service", service).
		Str("operation", operation).
		Str("status", "success").
		Msgf("✅ %s", message)
}

func LogWarn(service, operation, message string, err error, fields ...interface{}) {
	if err != nil {
		log.Warn().
			Str("service", service).
			Str("operation", operation).
			Err(err).
			Msgf("⚠️  %s", message)
	} else {
		log.Warn().
			Str("service", service).
			Str("operation", operation).
			Msgf("⚠️  %s", message)
	}
}

func LogError(service, operation, message string, err error, fields ...interface{}) {
	if err != nil {
		log.Error().
			Str("service", service).
			Str("operation", operation).
			Err(err).
			Msgf("❌ %s", message)
	} else {
		log.Error().
			Str("service", service).
			Str("operation", operation).
			Msgf("❌ %s", message)
	}
}

func LogDebug(service, operation, message string, fields ...interface{}) {
	log.Debug().
		Str("service", service).
		Str("operation", operation).
		Msgf("🔍 %s", message)
}