//backend/pkg/repository/order/order_errors.go

package order

import "errors"

// ErrOrderNotPending is returned when a payment finalization finds the order is no
// longer 'pending' (another request, usually the webhook, finished it first).
var ErrOrderNotPending = errors.New("order is not in pending status")