// audit/stub/paystack_stub.go
// audit/stub/paystack_stub.go
//
// A Paystack mock for integration and load testing. Standard library only.
//
// Paystack API surface (needs "Authorization: Bearer <PAYSTACK_SECRET_KEY>"):
//   POST /transaction/initialize
//   GET  /transaction/verify/{reference}
//
// Control surface (no auth; keep it on loopback, see the compose notes):
//   GET|POST /__pay/{ref}      mark a transaction paid / failed / reversed and send the webhook
//       ?status=success|failed|reversed|abandoned   (default success)
//       &amount=<kobo>   paid amount, to test amount mismatches (default: requested amount)
//       &currency=XXX    paid currency (default: requested currency)
//       &webhook=normal|none|dup:N|conc:N|delay:MS|bad_sig|tamper   (default normal; sent on success only)
//   GET|POST /__webhook/{ref}  send a signed charge.success without changing the transaction
//       ?claim=success   claim success even if unpaid (a lying webhook)
//       &mode=normal|dup:N|conc:N|delay:MS|bad_sig|tamper
//   GET|POST /__fault?endpoint=initialize|verify&mode=500|502|429|404|400|empty|malformed|timeout&count=N
//   GET|POST /__fault?mode=clear
//   GET /__stats       counters, in-flight and peak concurrency, latency percentiles per endpoint
//   GET /__requests    what the backend sent (the Authorization value is never stored); ?ref=&limit=
//   GET|POST /__reset  forget everything
//   GET /__health
//
// Environment:
//   PAYSTACK_SECRET_KEY    required. Bearer check and webhook signing key. Never logged.
//   STUB_PORT              default 9099
//   STUB_BIND              default "" (all interfaces). Inside Docker it must stay all interfaces,
//                          otherwise the backend container cannot reach the stub. Restrict exposure
//                          on the host side instead: ports: ["127.0.0.1:9099:9099"].
//   STUB_PUBLIC_URL        default http://localhost:9099 (authorization_url points at /__pay/{ref})
//   STUB_WEBHOOK_URL       e.g. http://backend:8081/api/webhooks/paystack. Empty disables webhooks.
//   STUB_WEBHOOK_RETRIES   default 0. Redeliveries after a non-2xx answer (normal, dup, conc, delay).
//   STUB_WEBHOOK_RETRY_MS  default 1000
//   STUB_DELAY_MS          default 150, STUB_JITTER_MS default 100 (added latency on /transaction/*)
//   STUB_FAIL_PCT          default 0 (random 502 on initialize and verify; prefer /__fault for assertions)
//   STUB_TIMEOUT_MS        default 30000 (how long a "timeout" fault hangs)

package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ---------------------------------------------------------------- state

type txn struct {
	ID          int64
	Reference   string
	Email       string
	Currency    string // requested at initialize
	Amount      int64  // requested at initialize, in kobo
	Metadata    any    // stored as sent, never mutated afterwards
	CallbackURL string
	AccessCode  string
	CreatedAt   time.Time

	Status       string // abandoned | success | failed | reversed
	PaidAmount   int64
	PaidCurrency string
	PaidAt       time.Time // zero until success
}

type fault struct {
	Mode      string
	Remaining int
}

type reqEntry struct {
	Time    string `json:"time"`
	Method  string `json:"method"`
	Path    string `json:"path"`
	AuthOK  bool   `json:"auth_ok"`
	Fault   string `json:"fault,omitempty"`
	Status  int    `json:"status"`
	Body    string `json:"body,omitempty"`
	Latency int64  `json:"latency_ms"`
}

const (
	maxBody     = 1 << 20
	maxLogged   = 2000
	maxLatency  = 50000
	loggedBytes = 4096
)

var (
	mu           sync.Mutex
	txns               = map[string]*txn{}
	nextID       int64 = 1000
	counts             = map[string]int{}
	faults             = map[string]*fault{}
	reqLog       []reqEntry
	latencies    = map[string][]float64{}
	authFailures int

	inFlight     int64
	peakInFlight int64

	secretKey      string
	webhookURL     string
	publicURL      string
	webhookRetries int
	webhookRetryMs int

	hookClient = &http.Client{Timeout: 10 * time.Second}
)

// ---------------------------------------------------------------- small helpers

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil {
		return v
	}
	return d
}

func envStr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func pause() {
	d := envInt("STUB_DELAY_MS", 150)
	if j := envInt("STUB_JITTER_MS", 100); j > 0 {
		d += rand.Intn(j)
	}
	time.Sleep(time.Duration(d) * time.Millisecond)
}

func reply(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	reply(w, code, map[string]any{"status": false, "message": msg})
}

func randHex(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte(rand.Intn(256))
	}
	return hex.EncodeToString(b)
}

func sign(body []byte, key string) string {
	m := hmac.New(sha512.New, []byte(key))
	m.Write(body)
	return hex.EncodeToString(m.Sum(nil))
}

func authorized(r *http.Request) bool {
	h := r.Header.Get("Authorization")
	const p = "Bearer "
	if !strings.HasPrefix(h, p) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(h[len(p):]), []byte(secretKey)) == 1
}

func iso(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// ---------------------------------------------------------------- response shapes

// txnData mirrors the "data" object Paystack returns from verify and sends in charge.success.
func txnData(t txn) map[string]any {
	amount, currency := t.Amount, t.Currency
	if t.PaidAmount > 0 {
		amount = t.PaidAmount
	}
	if t.PaidCurrency != "" {
		currency = t.PaidCurrency
	}
	gateway := map[string]string{
		"success":   "Successful",
		"failed":    "Declined",
		"reversed":  "Reversed",
		"abandoned": "The transaction was not completed",
	}[t.Status]

	var paidAt any
	if !t.PaidAt.IsZero() {
		paidAt = iso(t.PaidAt)
	}
	var auth any
	if t.Status == "success" || t.Status == "reversed" {
		auth = map[string]any{
			"authorization_code": "AUTH_" + t.AccessCode, "bin": "408408", "last4": "4081",
			"exp_month": "12", "exp_year": "2030", "channel": "card", "card_type": "visa",
			"bank": "TEST BANK", "country_code": "NG", "brand": "visa", "reusable": true,
			"signature": "SIG_" + t.AccessCode,
		}
	}
	return map[string]any{
		"id": t.ID, "domain": "test", "status": t.Status, "reference": t.Reference,
		"receipt_number": nil, "amount": amount, "requested_amount": t.Amount, "message": nil,
		"gateway_response": gateway, "paid_at": paidAt, "created_at": iso(t.CreatedAt),
		"transaction_date": iso(t.CreatedAt), "channel": "card", "currency": currency,
		"ip_address": "127.0.0.1", "metadata": t.Metadata, "log": nil,
		"fees": amount*15/1000 + 10000, "fees_split": nil, "authorization": auth,
		"customer": map[string]any{
			"id": t.ID + 1, "first_name": nil, "last_name": nil, "email": t.Email,
			"customer_code": "CUS_" + t.AccessCode, "phone": nil, "metadata": nil, "risk_action": "default",
		},
		"plan": nil, "split": map[string]any{}, "order_id": nil, "paidAt": paidAt,
		"createdAt": iso(t.CreatedAt), "requested_amount_currency": t.Currency,
		"pos_transaction_data": nil, "source": nil, "fees_breakdown": nil, "connect": nil, "subaccount": map[string]any{},
	}
}

// ---------------------------------------------------------------- faults, logging, stats

func takeFault(endpoint string) string {
	mu.Lock()
	defer mu.Unlock()
	if f := faults[endpoint]; f != nil && f.Remaining > 0 {
		f.Remaining--
		counts["fault"]++
		return f.Mode
	}
	return ""
}

// serveFault answers with the failure mode and reports whether it did.
func serveFault(w http.ResponseWriter, mode string) bool {
	switch mode {
	case "500", "502":
		code, _ := strconv.Atoi(mode)
		fail(w, code, "stub: simulated gateway error")
	case "429":
		w.Header().Set("Retry-After", "1")
		fail(w, 429, "stub: rate limited")
	case "404":
		fail(w, 404, "Transaction reference not found")
	case "400":
		fail(w, 400, "stub: simulated rejection")
	case "empty":
		w.WriteHeader(200)
	case "malformed":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"status":true,"data":`))
	case "timeout":
		time.Sleep(time.Duration(envInt("STUB_TIMEOUT_MS", 30000)) * time.Millisecond)
		fail(w, 504, "stub: simulated timeout")
	default:
		return false
	}
	return true
}

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (s *statusWriter) WriteHeader(c int) { s.code = c; s.ResponseWriter.WriteHeader(c) }

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	i := int(float64(len(sorted)-1) * p)
	return sorted[i]
}

// api wraps a /transaction/* handler: concurrency stats, auth, fault injection, latency, request log.
func api(endpoint string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		cur := atomic.AddInt64(&inFlight, 1)
		for {
			p := atomic.LoadInt64(&peakInFlight)
			if cur <= p || atomic.CompareAndSwapInt64(&peakInFlight, p, cur) {
				break
			}
		}
		defer atomic.AddInt64(&inFlight, -1)

		body, _ := io.ReadAll(io.LimitReader(r.Body, maxBody))
		r.Body = io.NopCloser(bytes.NewReader(body))
		sw := &statusWriter{ResponseWriter: w, code: 200}
		ok := authorized(r)
		applied := ""

		switch {
		case !ok:
			mu.Lock()
			authFailures++
			mu.Unlock()
			fail(sw, 401, "Invalid key")
		default:
			if applied = takeFault(endpoint); applied != "" && serveFault(sw, applied) {
				break
			}
			pause()
			if rand.Intn(100) < envInt("STUB_FAIL_PCT", 0) {
				fail(sw, 502, "stub: simulated failure")
				break
			}
			mu.Lock()
			counts[endpoint]++
			mu.Unlock()
			h(sw, r)
		}

		ms := time.Since(start).Milliseconds()
		entry := reqEntry{Time: iso(start), Method: r.Method, Path: r.URL.Path, AuthOK: ok,
			Fault: applied, Status: sw.code, Latency: ms}
		if len(body) > 0 {
			b := body
			if len(b) > loggedBytes {
				b = b[:loggedBytes]
			}
			entry.Body = string(b)
		}
		mu.Lock()
		reqLog = append(reqLog, entry)
		if len(reqLog) > maxLogged {
			reqLog = append([]reqEntry(nil), reqLog[len(reqLog)-maxLogged:]...)
		}
		l := append(latencies[endpoint], float64(time.Since(start).Microseconds())/1000)
		if len(l) > maxLatency {
			l = append([]float64(nil), l[len(l)/2:]...)
		}
		latencies[endpoint] = l
		mu.Unlock()
	}
}

// ---------------------------------------------------------------- Paystack endpoints

func handleInitialize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, 405, "Method not allowed")
		return
	}
	var in struct {
		Email       string `json:"email"`
		Amount      int64  `json:"amount"`
		Reference   string `json:"reference"`
		Currency    string `json:"currency"`
		CallbackURL string `json:"callback_url"`
		Metadata    any    `json:"metadata"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		fail(w, 400, "Invalid request body")
		return
	}
	if !strings.Contains(in.Email, "@") {
		fail(w, 400, "Invalid Email Address Passed")
		return
	}
	if in.Amount <= 0 {
		fail(w, 400, "Invalid Amount Sent")
		return
	}
	if in.Reference == "" {
		in.Reference = randHex(8)
	}
	if in.Currency == "" {
		in.Currency = "NGN"
	}

	mu.Lock()
	if _, dup := txns[in.Reference]; dup {
		mu.Unlock()
		fail(w, 400, "Duplicate Transaction Reference")
		return
	}
	nextID++
	t := &txn{ID: nextID, Reference: in.Reference, Email: in.Email, Currency: in.Currency,
		Amount: in.Amount, Metadata: in.Metadata, CallbackURL: in.CallbackURL,
		AccessCode: randHex(6), CreatedAt: time.Now().UTC(), Status: "abandoned"}
	txns[in.Reference] = t
	access := t.AccessCode
	mu.Unlock()

	reply(w, 200, map[string]any{"status": true, "message": "Authorization URL created",
		"data": map[string]any{"authorization_url": publicURL + "/__pay/" + in.Reference,
			"access_code": access, "reference": in.Reference}})
}

func handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, 405, "Method not allowed")
		return
	}
	ref := strings.TrimPrefix(r.URL.Path, "/transaction/verify/")

	// Copy everything needed while holding the lock; build the response after releasing it.
	mu.Lock()
	t := txns[ref]
	var snap txn
	if t != nil {
		snap = *t
	}
	mu.Unlock()

	if ref == "" || t == nil {
		fail(w, 404, "Transaction reference not found")
		return
	}
	reply(w, 200, map[string]any{"status": true, "message": "Verification successful", "data": txnData(snap)})
}

// ---------------------------------------------------------------- webhooks

type delivery struct {
	Code  int    `json:"code"`
	Error string `json:"error,omitempty"`
}

func post(body []byte, signature string, retry bool) delivery {
	attempts := 1
	if retry {
		attempts += webhookRetries
	}
	var last delivery
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(time.Duration(webhookRetryMs) * time.Millisecond)
		}
		req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(body))
		if err != nil {
			return delivery{Error: err.Error()}
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-paystack-signature", signature)
		resp, err := hookClient.Do(req)
		if err != nil {
			last = delivery{Error: err.Error()}
			continue
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		last = delivery{Code: resp.StatusCode}
		mu.Lock()
		counts["webhook"]++
		mu.Unlock()
		if resp.StatusCode/100 == 2 {
			return last
		}
	}
	return last
}

func buildEvent(snap txn, claimSuccess bool) map[string]any {
	data := txnData(snap)
	if claimSuccess {
		data["status"] = "success"
		data["gateway_response"] = "Successful"
		if data["paid_at"] == nil {
			data["paid_at"] = iso(time.Now())
		}
	}
	return map[string]any{"event": "charge.success", "data": data}
}

// dispatch sends the event according to mode and returns what happened.
func dispatch(snap txn, mode string, claimSuccess bool) map[string]any {
	if webhookURL == "" {
		return map[string]any{"mode": mode, "sent": false, "note": "STUB_WEBHOOK_URL is not set"}
	}
	name, arg, _ := strings.Cut(mode, ":")
	n, _ := strconv.Atoi(arg)
	ev := buildEvent(snap, claimSuccess)
	body, _ := json.Marshal(ev)
	out := map[string]any{"mode": mode}

	switch name {
	case "", "normal":
		out["deliveries"] = []delivery{post(body, sign(body, secretKey), true)}
	case "dup":
		if n < 2 {
			n = 2
		}
		var ds []delivery
		for i := 0; i < n; i++ {
			ds = append(ds, post(body, sign(body, secretKey), true))
		}
		out["deliveries"] = ds
	case "conc":
		if n < 2 {
			n = 2
		}
		ds := make([]delivery, n)
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				ds[i] = post(body, sign(body, secretKey), true)
			}(i)
		}
		wg.Wait()
		out["deliveries"] = ds
	case "delay":
		go func() {
			time.Sleep(time.Duration(n) * time.Millisecond)
			post(body, sign(body, secretKey), true)
		}()
		out["scheduled_in_ms"] = n
	case "bad_sig":
		out["deliveries"] = []delivery{post(body, sign(body, secretKey+"-wrong"), false)}
	case "tamper":
		// Signature is valid for the original body; the body that is sent has a different amount.
		sig := sign(body, secretKey)
		ev2 := buildEvent(snap, claimSuccess)
		ev2["data"].(map[string]any)["amount"] = snap.Amount + 100
		body2, _ := json.Marshal(ev2)
		out["deliveries"] = []delivery{post(body2, sig, false)}
	default:
		out["error"] = "unknown webhook mode"
	}
	return out
}

// ---------------------------------------------------------------- control endpoints

func handlePay(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimPrefix(r.URL.Path, "/__pay/")
	q := r.URL.Query()

	status := q.Get("status")
	if status == "" {
		status = "success"
	}
	switch status {
	case "success", "failed", "reversed", "abandoned":
	default:
		fail(w, 400, "status must be success, failed, reversed or abandoned")
		return
	}
	var paid int64
	if v := q.Get("amount"); v != "" {
		a, err := strconv.ParseInt(v, 10, 64)
		if err != nil || a <= 0 {
			fail(w, 400, "amount must be a positive integer (kobo)")
			return
		}
		paid = a
	}
	mode := q.Get("webhook")
	if mode == "" {
		mode = "normal"
	}

	mu.Lock()
	t := txns[ref]
	if t == nil {
		mu.Unlock()
		fail(w, 404, "Transaction reference not found")
		return
	}
	t.Status = status
	t.PaidAmount, t.PaidCurrency = 0, ""
	if status != "abandoned" {
		t.PaidAmount = t.Amount
		if paid > 0 {
			t.PaidAmount = paid
		}
		t.PaidCurrency = t.Currency
		if c := q.Get("currency"); c != "" {
			t.PaidCurrency = strings.ToUpper(c)
		}
	}
	if status == "success" {
		t.PaidAt = time.Now().UTC()
	} else {
		t.PaidAt = time.Time{}
	}
	snap := *t
	mu.Unlock()

	resp := map[string]any{"reference": ref, "status": status, "amount": snap.PaidAmount, "currency": snap.PaidCurrency}
	if status == "success" && mode != "none" {
		resp["webhook"] = dispatch(snap, mode, false)
	} else {
		resp["webhook"] = map[string]any{"sent": false}
	}
	reply(w, 200, resp)
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimPrefix(r.URL.Path, "/__webhook/")
	mode := r.URL.Query().Get("mode")
	claim := r.URL.Query().Get("claim") == "success"
	mu.Lock()
	t := txns[ref]
	var snap txn
	if t != nil {
		snap = *t
	}
	mu.Unlock()
	if t == nil {
		fail(w, 404, "Transaction reference not found")
		return
	}
	reply(w, 200, dispatch(snap, mode, claim))
}

func handleFault(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	mode := q.Get("mode")
	mu.Lock()
	defer mu.Unlock()
	if mode == "clear" {
		faults = map[string]*fault{}
		reply(w, 200, map[string]any{"cleared": true})
		return
	}
	ep := q.Get("endpoint")
	if ep != "initialize" && ep != "verify" {
		fail(w, 400, "endpoint must be initialize or verify")
		return
	}
	switch mode {
	case "500", "502", "429", "404", "400", "empty", "malformed", "timeout":
	default:
		fail(w, 400, "mode must be 500, 502, 429, 404, 400, empty, malformed, timeout or clear")
		return
	}
	n := 1
	if v, err := strconv.Atoi(q.Get("count")); err == nil && v > 0 {
		n = v
	}
	faults[ep] = &fault{Mode: mode, Remaining: n}
	reply(w, 200, map[string]any{"endpoint": ep, "mode": mode, "count": n})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	lat := map[string]any{}
	for ep, v := range latencies {
		s := append([]float64(nil), v...)
		sort.Float64s(s)
		lat[ep] = map[string]any{"count": len(s), "p50_ms": percentile(s, 0.50),
			"p95_ms": percentile(s, 0.95), "p99_ms": percentile(s, 0.99), "max_ms": percentile(s, 1)}
	}
	reply(w, 200, map[string]any{
		"initialized": counts["initialize"], "verified": counts["verify"], "tracked": len(txns),
		"auth_failures": authFailures, "faults_served": counts["fault"], "webhooks_delivered": counts["webhook"],
		"in_flight": atomic.LoadInt64(&inFlight), "peak_in_flight": atomic.LoadInt64(&peakInFlight),
		"latency_ms": lat,
	})
}

func handleRequests(w http.ResponseWriter, r *http.Request) {
	ref := r.URL.Query().Get("ref")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 200
	}
	mu.Lock()
	defer mu.Unlock()
	var out []reqEntry
	for _, e := range reqLog {
		if ref == "" || strings.Contains(e.Path, ref) || strings.Contains(e.Body, ref) {
			out = append(out, e)
		}
	}
	if len(out) > limit {
		out = out[len(out)-limit:]
	}
	reply(w, 200, map[string]any{"count": len(out), "requests": out})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	txns = map[string]*txn{}
	counts = map[string]int{}
	faults = map[string]*fault{}
	reqLog = nil
	latencies = map[string][]float64{}
	authFailures = 0
	mu.Unlock()
	atomic.StoreInt64(&peakInFlight, 0)
	w.WriteHeader(204)
}

// ---------------------------------------------------------------- main

func main() {
	secretKey = os.Getenv("PAYSTACK_SECRET_KEY")
	if secretKey == "" {
		log.Fatal("PAYSTACK_SECRET_KEY is not set. The stub needs the same key as the backend to check the Authorization header and sign webhooks.")
	}
	webhookURL = os.Getenv("STUB_WEBHOOK_URL")
	publicURL = strings.TrimRight(envStr("STUB_PUBLIC_URL", "http://localhost:9099"), "/")
	webhookRetries = envInt("STUB_WEBHOOK_RETRIES", 0)
	webhookRetryMs = envInt("STUB_WEBHOOK_RETRY_MS", 1000)

	mux := http.NewServeMux()
	mux.HandleFunc("/transaction/initialize", api("initialize", handleInitialize))
	mux.HandleFunc("/transaction/verify/", api("verify", handleVerify))
	mux.HandleFunc("/__pay/", handlePay)
	mux.HandleFunc("/__webhook/", handleWebhook)
	mux.HandleFunc("/__fault", handleFault)
	mux.HandleFunc("/__stats", handleStats)
	mux.HandleFunc("/__requests", handleRequests)
	mux.HandleFunc("/__reset", handleReset)
	mux.HandleFunc("/__health", func(w http.ResponseWriter, r *http.Request) { reply(w, 200, map[string]any{"ok": true}) })

	addr := envStr("STUB_BIND", "") + ":" + envStr("STUB_PORT", "9099")
	hook := "disabled"
	if webhookURL != "" {
		hook = webhookURL
	}
	log.Printf("paystack stub listening on %s (webhooks: %s, key check: on)", addr, hook)
	log.Fatal(http.ListenAndServe(addr, mux))
}