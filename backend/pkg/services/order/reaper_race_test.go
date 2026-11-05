// backend/ pkg/services/ order/reaper_race_test.go

package order

import (
	"context"
	"strings"
	"testing"
	"time"

	repoevent "github.com/eventify/backend/pkg/repository/event"
	repoorder "github.com/eventify/backend/pkg/repository/order"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// F-012: a payment landing between the reaper's read and its update must win.
func TestReaperRace_PaymentWinsOverExpiry(t *testing.T) {
	db := testhelper.NewTestDB(t)

	var dbName string
	require.NoError(t, db.Get(&dbName, "SELECT current_database()"))
	if !strings.Contains(strings.ToLower(dbName), "test") {
		t.Skipf("refusing to run against database %q (its name must contain 'test')", dbName)
	}
	var stale int
	require.NoError(t, db.Get(&stale, `SELECT count(*) FROM orders WHERE status = 'pending' AND created_at < now() - interval '15 minutes'`))
	if stale > 50 {
		t.Skipf("%d old pending orders in %q; the reaper reads only 100 per pass", stale, dbName)
	}

	organizer := testhelper.CreateTestUser(t, db)
	var etype string
	require.NoError(t, db.Get(&etype, `SELECT e.enumlabel::text FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'event_type' ORDER BY e.enumsortorder LIMIT 1`))

	eventID, tierID, orderID := uuid.New(), uuid.New(), uuid.New()
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM order_items WHERE order_id = $1`, orderID)
		_, _ = db.Exec(`DELETE FROM orders WHERE id = $1`, orderID)
		_, _ = db.Exec(`DELETE FROM ticket_tiers WHERE id = $1`, tierID)
		_, _ = db.Exec(`DELETE FROM events WHERE id = $1`, eventID)
		_, _ = db.Exec(`DELETE FROM users WHERE id = $1`, organizer)
	})

	_, err := db.Exec(`
		INSERT INTO events (id, organizer_id, event_title, event_description, category, event_type,
		                    event_image_url, venue_name, city, state, start_date, end_date)
		VALUES ($1, $2, 'Reaper race test', 'Reaper race test event', 'Music & concerts', $3::event_type,
		        'https://example.com/e.jpg', 'Venue', 'Lagos', 'Lagos',
		        now() + interval '7 days', now() + interval '7 days 3 hours')`, eventID, organizer, etype)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO ticket_tiers (id, event_id, name, price_kobo, capacity, sold, available)
		VALUES ($1, $2, 'Race', 100000, 10, 1, 9)`, tierID, eventID)
	require.NoError(t, err)
	_, err = db.Exec(`
		INSERT INTO orders (id, reference, status, subtotal, service_fee, vat_amount, final_total,
		                    customer_email, customer_first_name, customer_last_name, created_at, updated_at)
		VALUES ($1, $2, 'pending', 100000, 10000, 0, 110000, 'race@example.com', 'Race', 'Test',
		        now() - interval '16 minutes', now() - interval '16 minutes')`,
		orderID, "TIX_RACE_"+orderID.String()[:8])
	require.NoError(t, err)
	_, err = db.Exec(`
		INSERT INTO order_items (id, order_id, event_title, event_id, ticket_tier_id, tier_name, quantity, unit_price, subtotal)
		VALUES ($1, $2, 'Reaper race test', $3, $4, 'Race', 1, 100000, 100000)`,
		uuid.New(), orderID, eventID, tierID)
	require.NoError(t, err)

	svc := &OrderServiceImpl{
		OrderRepo: repoorder.NewPostgresOrderRepository(db),
		EventRepo: repoevent.NewPostgresEventRepository(db),
	}

	// Hold the order row, as a payment mid-finalization would.
	txA, err := db.Beginx()
	require.NoError(t, err)
	_, err = txA.Exec(`SELECT id FROM orders WHERE id = $1 FOR UPDATE`, orderID)
	require.NoError(t, err)

	done := make(chan error, 1)
	go func() { done <- svc.ReleaseExpiredStock(context.Background(), 15*time.Minute) }()

	// Wait until the reaper is really stuck on our row lock.
	blocked := false
	for i := 0; i < 50 && !blocked; i++ {
		var n int
		require.NoError(t, db.Get(&n, `SELECT count(*) FROM pg_stat_activity
			WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE 'UPDATE orders SET status%'`))
		if blocked = n > 0; !blocked {
			time.Sleep(50 * time.Millisecond)
		}
	}
	if !blocked {
		_ = txA.Rollback()
		t.Fatal("the reaper never reached its update; the test setup is invalid")
	}

	// The payment lands now.
	_, err = txA.Exec(`UPDATE orders SET status = 'success', amount_paid = final_total, paid_at = now(), updated_at = now() WHERE id = $1`, orderID)
	require.NoError(t, err)
	require.NoError(t, txA.Commit())

	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		t.Fatal("the reaper did not finish")
	}

	var status string
	require.NoError(t, db.Get(&status, `SELECT status::text FROM orders WHERE id = $1`, orderID))
	require.Equal(t, "success", status, "the reaper overwrote a paid order")
	var sold, avail int
	require.NoError(t, db.QueryRow(`SELECT sold, available FROM ticket_tiers WHERE id = $1`, tierID).Scan(&sold, &avail))
	require.Equal(t, 1, sold, "the reaper released stock that belongs to a paid order")
	require.Equal(t, 9, avail)
}