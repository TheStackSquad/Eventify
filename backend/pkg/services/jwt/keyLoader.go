// backend/pkg/services/jwt/keyLoader.go
package servicejwt

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"eventify/backend/pkg/utils"

	"io/ioutil"
	"os"
	"strings"

	//"github.com/rs/zerolog/log"
)

// loadRSAKeys tries multiple strategies to load RSA keys
func loadRSAKeys() (*rsa.PrivateKey, *rsa.PublicKey, error) {
	const service = "jwt"
	const operation = "load_rsa_keys"

	// Strategy 1: Load from files
	privateKey, publicKey, err := loadKeysFromFiles()
	if err == nil {
		utils.LogSuccess(service, operation, "RSA keys loaded from files")
		return privateKey, publicKey, nil
	}
	utils.LogDebug(service, operation, "Failed to load keys from files: %v", err)

	// Strategy 2: Load from environment variables
	privateKey, publicKey, err = loadKeysFromEnv()
	if err == nil {
		utils.LogSuccess(service, operation, "RSA keys loaded from environment variables")
		return privateKey, publicKey, nil
	}
	utils.LogDebug(service, operation, "Failed to load keys from environment: %v", err)

	// Strategy 3: Development fallback - generate new keys
	if os.Getenv("GIN_MODE") != "release" {
		utils.LogWarn(service, operation, "Generating new RSA keys for development", nil)
		return generateAndSaveKeys()
	}

	utils.LogError(service, operation, "Failed to load RSA keys from any source", err)
	return nil, nil, fmt.Errorf("failed to load RSA keys from any source")
}

func loadKeysFromFiles() (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privateKeyPath := getEnvOrDefault("RSA_PRIVATE_KEY_PATH", "./config/keys/private.pem")
	publicKeyPath := getEnvOrDefault("RSA_PUBLIC_KEY_PATH", "./config/keys/public.pem")

	// Read private key
	privateKeyBytes, err := ioutil.ReadFile(privateKeyPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	// Read public key
	publicKeyBytes, err := ioutil.ReadFile(publicKeyPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read public key file: %w", err)
	}

	// Parse keys
	privateKey, err := parsePrivateKey(privateKeyBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	publicKey, err := parsePublicKey(publicKeyBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	return privateKey, publicKey, nil
}

func loadKeysFromEnv() (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privateKeyPEM := os.Getenv("RSA_PRIVATE_KEY")
	publicKeyPEM := os.Getenv("RSA_PUBLIC_KEY")

	if privateKeyPEM == "" || publicKeyPEM == "" {
		return nil, nil, fmt.Errorf("RSA keys not found in environment")
	}

	privateKey, err := parsePrivateKey([]byte(privateKeyPEM))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse private key from env: %w", err)
	}

	publicKey, err := parsePublicKey([]byte(publicKeyPEM))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse public key from env: %w", err)
	}

	return privateKey, publicKey, nil
}

func parsePrivateKey(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// Try PKCS1
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}

	// Try PKCS8
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("not an RSA private key")
	}

	return rsaKey, nil
}

func parsePublicKey(pemBytes []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("not an RSA public key")
	}

	return rsaKey, nil
}

// validateKeyPair verifies that private and public keys match
func validateKeyPair(privateKey *rsa.PrivateKey, publicKey *rsa.PublicKey) error {
	const service = "jwt"
	const operation = "validate_key_pair"

	// Check modulus
	if privateKey.PublicKey.N.Cmp(publicKey.N) != 0 {
		utils.LogError(service, operation, "RSA key modulus mismatch", nil)
		return fmt.Errorf("RSA key modulus mismatch")
	}

	// Check exponent
	if privateKey.PublicKey.E != publicKey.E {
		utils.LogError(service, operation, "RSA key exponent mismatch", nil)
		return fmt.Errorf("RSA key exponent mismatch")
	}

	// Test encryption/decryption
	testData := []byte("test")
	encrypted, err := rsa.EncryptPKCS1v15(rand.Reader, publicKey, testData)
	if err != nil {
		utils.LogError(service, operation, "Encryption test failed", err)
		return fmt.Errorf("encryption test failed: %w", err)
	}

	decrypted, err := rsa.DecryptPKCS1v15(rand.Reader, privateKey, encrypted)
	if err != nil {
		utils.LogError(service, operation, "Decryption test failed", err)
		return fmt.Errorf("decryption test failed: %w", err)
	}

	if string(decrypted) != "test" {
		utils.LogError(service, operation, "Key pair validation failed: decrypted data mismatch", nil)
		return fmt.Errorf("key pair validation failed: decrypted data mismatch")
	}

	utils.LogDebug(service, operation, "Key pair validation successful")
	return nil
}

func generateAndSaveKeys() (*rsa.PrivateKey, *rsa.PublicKey, error) {
	const service = "jwt"
	const operation = "generate_keys"

	utils.LogInfo(service, operation, "Generating new 2048-bit RSA key pair...")

	// Generate private key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		utils.LogError(service, operation, "Failed to generate RSA private key", err)
		return nil, nil, fmt.Errorf("failed to generate RSA private key: %w", err)
	}

	// Create keys directory if it doesn't exist
	if err := os.MkdirAll("./config/keys", 0700); err != nil {
		utils.LogWarn(service, operation, "Failed to create config/keys directory", err)
		return privateKey, &privateKey.PublicKey, nil
	}

	// Save private key
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})

	if err := ioutil.WriteFile("./config/keys/private.pem", privateKeyPEM, 0600); err != nil {
		utils.LogWarn(service, operation, "Failed to save private key to file", err)
	}

	// Save public key
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		utils.LogError(service, operation, "Failed to marshal public key", err)
		return nil, nil, fmt.Errorf("failed to marshal public key: %w", err)
	}

	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	})

	if err := ioutil.WriteFile("./config/keys/public.pem", publicKeyPEM, 0644); err != nil {
		utils.LogWarn(service, operation, "Failed to save public key to file", err)
	}

	utils.LogSuccess(service, operation, "Generated and saved new RSA keys to config/keys/")
	return privateKey, &privateKey.PublicKey, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// FormatKeyForEnv converts a PEM key to a single-line string for .env files
func FormatKeyForEnv(pemBytes []byte) string {
	return strings.ReplaceAll(string(pemBytes), "\n", "\\n")
}