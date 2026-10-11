// backend/pkg/models/paystack_models.go
package models

// PAYSTACK WEBHOOK MODELS

// PaystackWebhook represents the webhook payload sent by Paystack.
// This is what we receive at the /api/webhooks/paystack endpoint.
type PaystackWebhook struct {
	Event string        `json:"event"` // e.g., "charge.success"
	Data  *PaystackData `json:"data"`
}

// ============================================================================
// PAYSTACK VERIFICATION RESPONSE
// ============================================================================

// PaystackVerificationResponse is the top-level response from Paystack's verify endpoint.
// Returned when we call: GET https://api.paystack.co/transaction/verify/:reference
type PaystackVerificationResponse struct {
	Status  bool          `json:"status"`
	Message string        `json:"message"`
	Data    *PaystackData `json:"data"`
}

// ============================================================================
// PAYSTACK TRANSACTION DATA (Core Model)
// ============================================================================

// PaystackData contains the complete transaction details from Paystack.
// This is used in both webhook payloads and verification responses.
type PaystackData struct {
	// Transaction IDs
	ID        int64   `json:"id"`
	Reference string  `json:"reference"`
	Domain    string  `json:"domain"`
	OrderID   *string `json:"order_id"`
	
	// Transaction Status
	Status           string  `json:"status"` // "success", "failed", "abandoned"
	GatewayResponse  string  `json:"gateway_response"`
	Message          *string `json:"message"`
	
	// Amount Information
	Amount          int `json:"amount"`           // Amount in kobo
	RequestedAmount int `json:"requested_amount"` // Originally requested amount
	Fees            int `json:"fees"`             // Paystack transaction fees
	
	// Payment Details
	Channel  string `json:"channel"`  // "card", "bank", "ussd", "qr", "mobile_money"
	Currency string `json:"currency"` // "NGN"
	
	// Timestamps
	PaidAt          string `json:"paid_at"`
	CreatedAt       string `json:"created_at"`
	TransactionDate string `json:"transaction_date"`
	
	// IP and Receipt
	IPAddress     string  `json:"ip_address"`
	ReceiptNumber *string `json:"receipt_number"`
	
	// Nested Objects
	Customer      *PaystackCustomer      `json:"customer,omitempty"`
	Authorization *PaystackAuthorization `json:"authorization,omitempty"`
	Metadata      interface{}            `json:"metadata,omitempty"`
	Log           *PaystackLog           `json:"log,omitempty"`
	
	// Complex Fields (typically null for simple transactions)
	FeesSplit          interface{} `json:"fees_split"`
	FeesBreakdown      interface{} `json:"fees_breakdown"`
	Plan               interface{} `json:"plan"`
	PlanObject         interface{} `json:"plan_object"`
	Split              interface{} `json:"split"`
	Subaccount         interface{} `json:"subaccount"`
	Connect            interface{} `json:"connect"`
	PosTransactionData interface{} `json:"pos_transaction_data"`
	Source             *string     `json:"source"`
}

// ============================================================================
// PAYSTACK CUSTOMER MODEL
// ============================================================================

// PaystackCustomer contains customer information from Paystack.
type PaystackCustomer struct {
	ID                       int64       `json:"id"`
	FirstName                string      `json:"first_name"`
	LastName                 string      `json:"last_name"`
	Email                    string      `json:"email"`
	CustomerCode             string      `json:"customer_code"`
	Phone                    string      `json:"phone"`
	RiskAction               string      `json:"risk_action"`
	InternationalFormatPhone *string     `json:"international_format_phone"`
	Metadata                 interface{} `json:"metadata"`
}

// ============================================================================
// PAYSTACK AUTHORIZATION MODEL
// ============================================================================

// PaystackAuthorization contains card/bank authorization details.
type PaystackAuthorization struct {
	AuthorizationCode string `json:"authorization_code"`
	Bin               string `json:"bin"`               // First 6 digits of card
	Last4             string `json:"last4"`             // Last 4 digits of card
	ExpMonth          string `json:"exp_month"`
	ExpYear           string `json:"exp_year"`
	Channel           string `json:"channel"`           // "card", "bank"
	CardType          string `json:"card_type"`         // "visa", "mastercard"
	Bank              string `json:"bank"`
	CountryCode       string `json:"country_code"`
	Brand             string `json:"brand"`             // "visa", "mastercard"
	Reusable          bool   `json:"reusable"`
	Signature         string `json:"signature"`
	AccountName       *string `json:"account_name"`
	ReceiverBankAccountNumber *string `json:"receiver_bank_account_number"`
	ReceiverBank              *string `json:"receiver_bank"`
}

// ============================================================================
// PAYSTACK METADATA MODEL
// ============================================================================

// PaystackMetadata contains custom metadata sent with the transaction.
// This is what we send from the frontend and receive back in webhooks.
type PaystackMetadata struct {
	// Custom application data
	Reference    string      `json:"reference"`
	Timestamp    string      `json:"timestamp"`
	CustomerInfo interface{} `json:"customer_info,omitempty"`
	CartItems    string      `json:"cart_items,omitempty"`
	Referrer     string      `json:"referrer,omitempty"`
	
	// Structured custom fields
	CustomFields []CustomField `json:"custom_fields,omitempty"`
}

// CustomField represents a custom field in Paystack metadata.
type CustomField struct {
	DisplayName  string `json:"display_name"`
	VariableName string `json:"variable_name"`
	Value        string `json:"value"`
}

// ============================================================================
// PAYSTACK TRANSACTION LOG
// ============================================================================

// PaystackLog contains transaction processing logs from Paystack.
type PaystackLog struct {
	StartTime int64              `json:"start_time"`
	TimeSpent int                `json:"time_spent"` // in milliseconds
	Attempts  int                `json:"attempts"`
	Errors    int                `json:"errors"`
	Success   bool               `json:"success"`
	Mobile    bool               `json:"mobile"`
	Input     []interface{}      `json:"input"`
	History   []PaystackLogEntry `json:"history"`
}

// PaystackLogEntry represents a single log entry in the transaction history.
type PaystackLogEntry struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Time    int    `json:"time"`
}

// ============================================================================
// PAYSTACK INITIALIZATION MODELS (For future use)
// ============================================================================

// PaystackInitializeRequest represents the request to initialize a transaction.
// Used if you want to initialize payments server-side instead of client-side.
type PaystackInitializeRequest struct {
	Email       string                 `json:"email"`
	Amount      int                    `json:"amount"` // in kobo
	Reference   string                 `json:"reference"`
	CallbackURL string                 `json:"callback_url,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Channels    []string               `json:"channels,omitempty"` // ["card", "bank", "ussd"]
	Currency    string                 `json:"currency,omitempty"` // defaults to "NGN"
}

// PaystackInitializeResponse represents the response from initializing a transaction.
type PaystackInitializeResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

// ============================================================================
// PAYMENT ERROR MODELS
// ============================================================================

// PaymentError represents a standardized payment error response.
type PaymentError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Common error codes
const (
	ErrCodeInvalidSignature   = "INVALID_SIGNATURE"
	ErrCodeAmountMismatch     = "AMOUNT_MISMATCH"
	ErrCodeOrderNotFound      = "ORDER_NOT_FOUND"
	ErrCodeTransactionFailed  = "TRANSACTION_FAILED"
	ErrCodeVerificationFailed = "VERIFICATION_FAILED"
	ErrCodeAlreadyProcessed   = "ALREADY_PROCESSED"
)