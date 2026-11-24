// backend/pkg/handlers/auth/auth_input_test.go

package auth

import (
    "net/http/httptest"
    "reflect"
    "testing"

    "github.com/gin-gonic/gin"
)

func TestBearerToken(t *testing.T) {
    gin.SetMode(gin.TestMode)
    cases := []struct{ header, want string }{
        {"Bearer abc", "abc"}, {"Bearer  abc  ", "abc"}, {"bearer abc", ""},
        {"Bearer", ""}, {"Bearer a b", ""}, {"Basic abc", ""}, {"", ""},
    }
    for _, tc := range cases {
        c, _ := gin.CreateTestContext(httptest.NewRecorder())
        c.Request = httptest.NewRequest("GET", "/", nil)
        if tc.header != "" {
            c.Request.Header.Set("Authorization", tc.header)
        }
        if got := bearerToken(c); got != tc.want {
            t.Errorf("header %q: got %q, want %q", tc.header, got, tc.want)
        }
    }
}

// A sign-up may set only name, email and password. Adding a field here (an id, a role) must be a deliberate choice.
func TestSignupInputOnlyHasNameEmailPassword(t *testing.T) {
    if n := reflect.TypeOf(signupInput{}).NumField(); n != 3 {
        t.Fatalf("signupInput has %d fields; a sign-up may set only name, email and password (F417)", n)
    }
}
