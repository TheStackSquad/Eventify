DROP TRIGGER IF EXISTS trg_orders_status_guard ON orders;
DROP FUNCTION IF EXISTS orders_guard_status_transition();
