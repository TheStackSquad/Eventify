-- 000014: orders.status may only follow the legal order lifecycle (ORD, finding F211).
-- Defence in depth: the application already guards its updates with "AND status = 'pending'";
-- this stops every other writer (a script, an admin tool, a future code path) and protects a paid
-- order from being flipped to fraud or expired by a racing request.
--
--   pending    -> processing, success, failed, expired, fraud
--   processing -> success, failed, expired, fraud
--   success, failed, expired, fraud -> refunded
--   anything else is refused; a same-status update is a no-op and allowed; nothing returns to pending.
-- Late-payment fulfilment (expired/failed -> success) is deliberately NOT allowed yet; a later
-- migration widens this once the reconciliation policy is decided.
CREATE OR REPLACE FUNCTION orders_guard_status_transition() RETURNS trigger AS $$
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    IF (OLD.status = 'pending'    AND NEW.status IN ('processing', 'success', 'failed', 'expired', 'fraud'))
    OR (OLD.status = 'processing' AND NEW.status IN ('success', 'failed', 'expired', 'fraud'))
    OR (OLD.status IN ('success', 'failed', 'expired', 'fraud') AND NEW.status = 'refunded')
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'illegal order status change % -> % (order %)', OLD.status, NEW.status, OLD.id
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_status_guard ON orders;
CREATE TRIGGER trg_orders_status_guard
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION orders_guard_status_transition();
