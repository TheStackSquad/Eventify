//backend/pkg/services/paystack/paystack_verify_test.go

package paystack

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func clientFor(srv *httptest.Server) *ClientImpl {
	return &ClientImpl{SecretKey: "sk_test_x", HTTPClient: srv.Client(), BaseURL: srv.URL}
}

func TestVerifyTransaction_ErrorClassification(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{"unknown reference (404)", 404, `{"status":false,"message":"Transaction reference not found"}`, ErrTransactionNotFound},
		{"unknown reference (400 + message)", 400, `{"status":false,"message":"Transaction reference not found"}`, ErrTransactionNotFound},
		{"paystack outage", 503, `oops`, ErrUnavailable},
		{"rate limited", 429, `{}`, ErrUnavailable},
		{"bad key", 401, `{"status":false,"message":"Invalid key"}`, ErrRejected},
		{"garbage success body", 200, `not json`, ErrUnavailable},
		{"status false on 200", 200, `{"status":false,"message":"nope"}`, ErrRejected},
	}
	for _, tc := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = w.Write([]byte(tc.body))
		}))
		_, err := clientFor(srv).VerifyTransaction(context.Background(), "ref")
		srv.Close()
		assert.ErrorIs(t, err, tc.want, tc.name)
	}
}

func TestVerifyTransaction_ReferenceIsPathEscaped(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		_, _ = w.Write([]byte(`{"status":true,"message":"ok","data":{"status":"success"}}`))
	}))
	defer srv.Close()

	_, err := clientFor(srv).VerifyTransaction(context.Background(), "../secret?x=1")

	require.NoError(t, err)
	assert.Equal(t, "/transaction/verify/..%2Fsecret%3Fx=1", gotPath)
}