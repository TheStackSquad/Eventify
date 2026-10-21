// audit/stub/paystack_stub.go

package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type txn struct {
	Amount int64
	Paid   bool
}

var (
	mu              sync.Mutex
	txns            = map[string]*txn{}
	inits, verifies int
)

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil {
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
	json.NewEncoder(w).Encode(v)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/transaction/initialize", func(w http.ResponseWriter, r *http.Request) {
		pause()
		if rand.Intn(100) < envInt("STUB_FAIL_PCT", 0) {
			reply(w, 502, map[string]any{"status": false, "message": "stub: simulated failure"})
			return
		}
		var in struct {
			Amount    int64  `json:"amount"`
			Reference string `json:"reference"`
		}
		json.NewDecoder(r.Body).Decode(&in)
		mu.Lock()
		txns[in.Reference] = &txn{Amount: in.Amount}
		inits++
		mu.Unlock()
		reply(w, 200, map[string]any{"status": true, "message": "Authorization URL created",
			"data": map[string]any{"authorization_url": "http://stub.local/pay/" + in.Reference,
				"access_code": "stub", "reference": in.Reference}})
	})

	mux.HandleFunc("/transaction/verify/", func(w http.ResponseWriter, r *http.Request) {
		pause()
		ref := strings.TrimPrefix(r.URL.Path, "/transaction/verify/")
		mu.Lock()
		t := txns[ref]
		verifies++
		mu.Unlock()
		if t == nil {
			reply(w, 404, map[string]any{"status": false, "message": "Transaction reference not found"})
			return
		}
		status := "abandoned" // what real Paystack returns for an unpaid transaction, as far as I know
		if t.Paid {
			status = "success"
		}
		reply(w, 200, map[string]any{"status": true, "message": "Verification successful",
			"data": map[string]any{"id": 1, "status": status, "reference": ref, "amount": t.Amount,
				"fees": t.Amount*15/1000 + 10000, "channel": "card", "currency": "NGN",
				"paid_at": time.Now().UTC().Format("2006-01-02T15:04:05.000Z")}})
	})

	mux.HandleFunc("/__pay/", func(w http.ResponseWriter, r *http.Request) {
		ref := strings.TrimPrefix(r.URL.Path, "/__pay/")
		mu.Lock()
		if t := txns[ref]; t != nil {
			t.Paid = true
		}
		mu.Unlock()
		w.WriteHeader(204)
	})
	mux.HandleFunc("/__stats", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		reply(w, 200, map[string]int{"initialized": inits, "verified": verifies, "tracked": len(txns)})
	})
	mux.HandleFunc("/__reset", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		txns = map[string]*txn{}
		inits, verifies = 0, 0
		mu.Unlock()
		w.WriteHeader(204)
	})

	port := os.Getenv("STUB_PORT")
	if port == "" {
		port = "9099"
	}
	log.Printf("paystack stub listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}