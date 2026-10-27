--
-- PostgreSQL database dump
--

\restrict jKxFl2baYJW7xRpIRATY5Owey2z5OHN9NC9fa6Vy7bQpWsFXvRbb9XnESk3f2Cx

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_type AS ENUM (
    'physical',
    'virtual'
);


--
-- Name: feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedback_type AS ENUM (
    'suggestion',
    'complaint',
    'feedback'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'processing',
    'success',
    'failed',
    'refunded',
    'fraud',
    'expired'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'active',
    'used',
    'canceled',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'customer',
    'vendor',
    'admin'
);


--
-- Name: vendor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_status AS ENUM (
    'draft',
    'pending_approval',
    'active',
    'suspended',
    'deleted'
);


--
-- Name: cleanup_old_profile_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_profile_views() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Delete views older than 90 days every 1000 inserts
    IF (SELECT COUNT(*) FROM profile_views) % 1000 = 0 THEN
        DELETE FROM profile_views 
        WHERE viewed_at < NOW() - INTERVAL '90 days';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: cleanup_profile_views_90d(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_profile_views_90d() RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    DELETE FROM profile_views
    WHERE viewed_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN QUERY SELECT affected_rows;
END;
$$;


--
-- Name: FUNCTION cleanup_profile_views_90d(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_profile_views_90d() IS 'Batch cleanup for views older than 90 days. Run nightly via cron: SELECT cleanup_profile_views_90d();';


--
-- Name: expire_old_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_subscriptions() RETURNS TABLE(expired_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE subscriptions
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN QUERY SELECT affected_rows;
END;
$$;


--
-- Name: FUNCTION expire_old_subscriptions(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.expire_old_subscriptions() IS 'Batch job to expire subscriptions past their expiry date. Run daily via cron.';


--
-- Name: fn_calc_vendor_trust_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_calc_vendor_trust_score(vendor_uuid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. Calculate total weight from all reviews (weight = 5.00) and get total count
    WITH review_sum AS (
        SELECT
            COALESCE(SUM(r.trust_weight), 0) AS total_review_weight,
            COALESCE(COUNT(r.id), 0) AS review_count
        FROM reviews r
        WHERE r.vendor_id = vendor_uuid
    ),
    -- 2. Calculate total weight from all inquiries (weight = 1.00)
    inquiry_sum AS (
        SELECT
            COALESCE(SUM(i.trust_weight), 0) AS total_inquiry_weight
        FROM inquiries i
        WHERE i.vendor_id = vendor_uuid
    )
    -- 3. Insert or Update the vendor_trust_score table
    INSERT INTO vendor_trust_score (vendor_id, total_trust_weight, review_count, updated_at)
    SELECT
        vendor_uuid,
        rs.total_review_weight + isum.total_inquiry_weight,
        rs.review_count,
        NOW()
    FROM review_sum rs, inquiry_sum isum
    ON CONFLICT (vendor_id) DO UPDATE
    SET
        total_trust_weight = EXCLUDED.total_trust_weight,
        review_count = EXCLUDED.review_count,
        updated_at = EXCLUDED.updated_at;
END;
$$;


--
-- Name: get_profile_view_count_30d(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profile_view_count_30d(p_vendor_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO view_count
    FROM profile_views
    WHERE vendor_id = p_vendor_id
      AND viewed_at > NOW() - INTERVAL '30 days';
    
    RETURN COALESCE(view_count, 0);
END;
$$;


--
-- Name: FUNCTION get_profile_view_count_30d(p_vendor_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_profile_view_count_30d(p_vendor_id uuid) IS 'Returns the number of profile views in the last 30 days for a vendor';


--
-- Name: get_recent_profile_views(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_profile_views(p_vendor_id uuid, p_limit integer DEFAULT 100, p_days integer DEFAULT 30) RETURNS TABLE(view_id uuid, viewer_id uuid, viewer_ip character varying, session_id character varying, user_agent text, viewed_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.viewer_id,
        pv.viewer_ip,
        pv.session_id,
        pv.user_agent,
        pv.viewed_at
    FROM profile_views pv
    WHERE pv.vendor_id = p_vendor_id
      AND pv.viewed_at > NOW() - (p_days || ' days')::INTERVAL
    ORDER BY pv.viewed_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION get_recent_profile_views(p_vendor_id uuid, p_limit integer, p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_recent_profile_views(p_vendor_id uuid, p_limit integer, p_days integer) IS 'Returns recent profile views for a vendor with pagination';


--
-- Name: get_vendor_active_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vendor_active_subscription(p_vendor_id uuid) RETURNS TABLE(id uuid, tier character varying, status character varying, expires_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.tier, s.status, s.expires_at
    FROM subscriptions s
    WHERE s.vendor_id = p_vendor_id
      AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$;


--
-- Name: FUNCTION get_vendor_active_subscription(p_vendor_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_vendor_active_subscription(p_vendor_id uuid) IS 'Returns active subscription for a vendor. Used for feature gating.';


--
-- Name: protect_sold_ticket_prices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_sold_ticket_prices() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Fix: Use 'price_kobo' instead of 'price'
    IF OLD.sold > 0 AND OLD.price_kobo IS DISTINCT FROM NEW.price_kobo THEN
        RAISE EXCEPTION 'cannot change price of a tier that has existing sales';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: record_profile_view(uuid, uuid, character varying, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_profile_view(p_vendor_id uuid, p_viewer_id uuid, p_viewer_ip character varying, p_session_id character varying, p_user_agent text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    rows_inserted INTEGER := 0;
    hours_ago_24 TIMESTAMP := NOW() - INTERVAL '24 hours';
    hours_ago_6 TIMESTAMP := NOW() - INTERVAL '6 hours';
BEGIN
    -- Validate required parameters
    IF p_session_id IS NULL OR p_session_id = '' THEN
        RAISE EXCEPTION 'session_id cannot be null or empty';
    END IF;
    
    IF p_viewer_ip IS NULL OR p_viewer_ip = '' THEN
        RAISE EXCEPTION 'viewer_ip cannot be null or empty';
    END IF;
    
    -- Attempt to insert with anti-gaming deduplication
    INSERT INTO profile_views (
        vendor_id, 
        viewer_id, 
        viewer_ip, 
        session_id, 
        user_agent
    )
    SELECT 
        p_vendor_id, 
        p_viewer_id, 
        p_viewer_ip, 
        p_session_id, 
        p_user_agent
    WHERE NOT EXISTS (
        SELECT 1 FROM profile_views
        WHERE vendor_id = p_vendor_id
          AND (
              -- RULE 1: Same session (immediate duplicate prevention)
              (session_id = p_session_id)
              OR
              -- RULE 2: Same IP in last 24 hours
              (viewer_ip = p_viewer_ip AND viewed_at > hours_ago_24)
              OR
              -- RULE 3: Same logged-in user in last 6 hours
              (viewer_id = p_viewer_id AND viewer_id IS NOT NULL AND viewed_at > hours_ago_6)
          )
    );
    
    -- Check if row was inserted
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    
    RETURN rows_inserted > 0;
EXCEPTION
    WHEN unique_violation THEN
        RETURN FALSE;
    WHEN OTHERS THEN
        RAISE;
END;
$$;


--
-- Name: FUNCTION record_profile_view(p_vendor_id uuid, p_viewer_id uuid, p_viewer_ip character varying, p_session_id character varying, p_user_agent text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_profile_view(p_vendor_id uuid, p_viewer_id uuid, p_viewer_ip character varying, p_session_id character varying, p_user_agent text) IS 'Records a profile view with anti-gaming checks. Returns TRUE if recorded, FALSE if duplicate.';


--
-- Name: refresh_vendor_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_vendor_analytics() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- CONCURRENTLY allows queries while refreshing
    REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_daily_metrics;
    
    -- Log the refresh (optional)
    RAISE NOTICE 'vendor_daily_metrics refreshed at %', NOW();
END;
$$;


--
-- Name: sync_vendor_subscription_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_vendor_subscription_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When subscription becomes active
    IF NEW.status = 'active' AND (NEW.expires_at IS NULL OR NEW.expires_at > NOW()) THEN
        UPDATE vendors 
        SET subscription_tier = NEW.tier,
            updated_at = NOW()
        WHERE id = NEW.vendor_id;
    
    -- When subscription expires or gets cancelled
    ELSIF NEW.status IN ('expired', 'cancelled') OR 
          (NEW.expires_at IS NOT NULL AND NEW.expires_at <= NOW()) THEN
        -- Check if there's another active subscription
        IF NOT EXISTS (
            SELECT 1 FROM subscriptions 
            WHERE vendor_id = NEW.vendor_id 
              AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW())
              AND id != NEW.id
        ) THEN
            UPDATE vendors 
            SET subscription_tier = 'free',
                updated_at = NOW()
            WHERE id = NEW.vendor_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: trg_update_trust_score_on_inquiry_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_update_trust_score_on_inquiry_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM FN_CALC_VENDOR_TRUST_SCORE(NEW.vendor_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM FN_CALC_VENDOR_TRUST_SCORE(OLD.vendor_id);
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: trg_update_trust_score_on_review_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_update_trust_score_on_review_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM FN_CALC_VENDOR_TRUST_SCORE(NEW.vendor_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM FN_CALC_VENDOR_TRUST_SCORE(OLD.vendor_id);
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: update_subscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: validate_subscription_activation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_subscription_activation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If status is changing to 'active'
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        -- Ensure payment_reference is present
        IF NEW.payment_reference IS NULL OR NEW.payment_reference = '' THEN
            RAISE EXCEPTION 'Cannot activate subscription without payment_reference';
        END IF;
        
        -- Ensure expires_at is set
        IF NEW.expires_at IS NULL THEN
            RAISE EXCEPTION 'Cannot activate subscription without expires_at date';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email text NOT NULL,
    subject text NOT NULL,
    template_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organizer_id uuid NOT NULL,
    event_title character varying(255) NOT NULL,
    event_description text NOT NULL,
    event_slug character varying(255),
    category character varying(100) NOT NULL,
    event_type public.event_type NOT NULL,
    event_image_url character varying(255) NOT NULL,
    venue_name character varying(255) NOT NULL,
    venue_address character varying(255),
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    country character varying(100),
    virtual_platform character varying(100),
    meeting_link character varying(255),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    max_attendees integer,
    paystack_subaccount_code character varying(100),
    tags text[],
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_category_not_empty CHECK (((category)::text <> ''::text)),
    CONSTRAINT check_event_description_not_empty CHECK ((event_description <> ''::text)),
    CONSTRAINT check_event_title_not_empty CHECK (((event_title)::text <> ''::text)),
    CONSTRAINT chk_category_not_empty CHECK ((length(TRIM(BOTH FROM category)) > 0)),
    CONSTRAINT chk_description_not_empty CHECK ((length(TRIM(BOTH FROM event_description)) > 0)),
    CONSTRAINT chk_end_after_start CHECK ((end_date >= start_date)),
    CONSTRAINT chk_max_attendees_positive CHECK (((max_attendees IS NULL) OR (max_attendees > 0))),
    CONSTRAINT chk_title_not_empty CHECK ((length(TRIM(BOTH FROM event_title)) > 0))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    type public.feedback_type NOT NULL,
    message text NOT NULL,
    image_url character varying(255),
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id character varying(255)
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id uuid NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    message text NOT NULL,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id character varying(255),
    trust_weight numeric(3,2) DEFAULT 1.00 NOT NULL
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    email character varying(255) NOT NULL,
    failed_attempts integer DEFAULT 0,
    last_attempt_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    event_title character varying(255) NOT NULL,
    event_id uuid NOT NULL,
    ticket_tier_id uuid NOT NULL,
    tier_name character varying(100) NOT NULL,
    quantity integer NOT NULL,
    unit_price integer NOT NULL,
    subtotal integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event_start_date timestamp without time zone,
    event_end_date timestamp without time zone,
    event_city character varying(255),
    event_state character varying(100),
    event_venue character varying(255),
    event_address text,
    event_thumbnail text
);


--
-- Name: TABLE order_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_items IS 'Order items with complete event snapshot at time of purchase. Event fields are denormalized for historical integrity.';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    reference character varying(255) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    subtotal integer NOT NULL,
    service_fee integer NOT NULL,
    vat_amount integer NOT NULL,
    final_total integer NOT NULL,
    amount_paid integer DEFAULT 0 NOT NULL,
    payment_channel character varying(100),
    paid_at timestamp with time zone,
    customer_email character varying(255) NOT NULL,
    customer_first_name character varying(255) NOT NULL,
    customer_last_name character varying(255) NOT NULL,
    customer_phone character varying(20),
    ip_address character varying(45),
    user_agent character varying(255),
    processed_by character varying(255),
    webhook_attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id character varying(255),
    paystack_fee bigint DEFAULT 0,
    app_profit bigint DEFAULT 0
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    gateway_tx_id character varying(255),
    gateway_reference character varying(255) NOT NULL,
    amount_paid integer NOT NULL,
    fees_paid integer DEFAULT 0 NOT NULL,
    currency character varying(10) NOT NULL,
    status character varying(50) NOT NULL,
    gateway_response character varying(255),
    channel character varying(100),
    ip_address character varying(45),
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: profile_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    viewer_id uuid,
    viewer_ip character varying(45) NOT NULL,
    user_agent text,
    session_id character varying(255) NOT NULL,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_ip CHECK (((viewer_ip IS NOT NULL) AND ((viewer_ip)::text <> ''::text))),
    CONSTRAINT valid_session_id CHECK (((session_id IS NOT NULL) AND ((session_id)::text <> ''::text)))
);


--
-- Name: TABLE profile_views; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profile_views IS 'Tracks vendor profile views with anti-gaming deduplication';


--
-- Name: COLUMN profile_views.viewer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profile_views.viewer_id IS 'UUID of logged-in user viewing the profile, NULL if anonymous';


--
-- Name: COLUMN profile_views.viewer_ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profile_views.viewer_ip IS 'IP address of viewer for rate limiting and anti-gaming';


--
-- Name: COLUMN profile_views.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profile_views.session_id IS 'Session identifier from frontend cookie for deduplication';


--
-- Name: COLUMN profile_views.viewed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profile_views.viewed_at IS 'Timestamp when profile was viewed';


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    consumed_at timestamp with time zone,
    parent_id uuid,
    ip_address inet,
    user_agent text
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id uuid NOT NULL,
    user_id uuid,
    rating smallint NOT NULL,
    comment text NOT NULL,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    is_verified boolean DEFAULT false,
    trust_weight numeric(3,2) DEFAULT 5.00,
    CONSTRAINT check_rating_range CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    reference character varying(100) NOT NULL,
    vendor_id uuid NOT NULL,
    subscription_id uuid,
    tier character varying(20) NOT NULL,
    amount_kobo bigint NOT NULL,
    currency character(3) DEFAULT 'NGN'::bpchar NOT NULL,
    status character varying(20) DEFAULT 'initiated'::character varying NOT NULL,
    paid_amount_kobo bigint,
    paid_currency character(3),
    channel character varying(30),
    review_reason text,
    webhook_attempts integer DEFAULT 0 NOT NULL,
    paid_at timestamp with time zone,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sp_valid_status CHECK (((status)::text = ANY ((ARRAY['initiated'::character varying, 'applied'::character varying, 'failed'::character varying, 'needs_review'::character varying])::text[]))),
    CONSTRAINT sp_valid_tier CHECK (((tier)::text = ANY ((ARRAY['basic'::character varying, 'premium'::character varying, 'featured'::character varying])::text[]))),
    CONSTRAINT subscription_payments_amount_kobo_check CHECK ((amount_kobo > 0))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    tier character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    starts_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    auto_renew boolean DEFAULT false NOT NULL,
    price bigint NOT NULL,
    currency character varying(3) DEFAULT 'NGN'::character varying NOT NULL,
    payment_reference character varying(255),
    payment_method character varying(50),
    last_payment_date timestamp without time zone,
    next_payment_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    webhook_attempts integer DEFAULT 0,
    reminder_7d_sent_at timestamp with time zone,
    reminder_3d_sent_at timestamp with time zone,
    reminder_1d_sent_at timestamp with time zone,
    payment_success_sent_at timestamp with time zone,
    expired_notice_sent_at timestamp with time zone,
    CONSTRAINT valid_currency CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT valid_price CHECK ((price >= 0)),
    CONSTRAINT valid_status CHECK (((status)::text = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT valid_tier CHECK (((tier)::text = ANY (ARRAY[('free'::character varying)::text, ('basic'::character varying)::text, ('premium'::character varying)::text, ('featured'::character varying)::text])))
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'Stores vendor subscription tiers, payment tracking, and renewal information';


--
-- Name: COLUMN subscriptions.tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.tier IS 'Subscription tier: free, basic, premium, featured';


--
-- Name: COLUMN subscriptions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.status IS 'Subscription status: pending, active, expired, canceled';


--
-- Name: COLUMN subscriptions.price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.price IS 'Price in Kobo (Nigerian currency subunit: 1 Naira = 100 Kobo)';


--
-- Name: COLUMN subscriptions.payment_reference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.payment_reference IS 'Unique Paystack transaction reference for idempotency';


--
-- Name: COLUMN subscriptions.reminder_7d_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.reminder_7d_sent_at IS 'Timestamp when 7-day expiry reminder email was sent to user';


--
-- Name: COLUMN subscriptions.reminder_3d_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.reminder_3d_sent_at IS 'Timestamp when 3-day expiry reminder email was sent to user';


--
-- Name: COLUMN subscriptions.reminder_1d_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.reminder_1d_sent_at IS 'Timestamp when 1-day expiry reminder email was sent to user';


--
-- Name: COLUMN subscriptions.payment_success_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.payment_success_sent_at IS 'Timestamp when payment confirmation email was sent to user';


--
-- Name: COLUMN subscriptions.expired_notice_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.expired_notice_sent_at IS 'Timestamp when subscription expired notification was sent to user';


--
-- Name: CONSTRAINT valid_status ON subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT valid_status ON public.subscriptions IS 'Valid subscription statuses: pending (payment initiated), active (paid and current), expired (past end date), cancelled (manually cancelled or duplicate cleanup)';


--
-- Name: ticket_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_tiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    name character varying(100) CONSTRAINT ticket_tiers_tier_name_not_null NOT NULL,
    price_kobo integer DEFAULT 0.00 CONSTRAINT ticket_tiers_price_not_null NOT NULL,
    capacity integer CONSTRAINT ticket_tiers_quantity_not_null NOT NULL,
    description character varying(255),
    sold integer DEFAULT 0 CONSTRAINT ticket_tiers_tickets_sold_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    available integer NOT NULL,
    CONSTRAINT check_available_non_negative CHECK ((available >= 0)),
    CONSTRAINT check_capacity_positive CHECK ((capacity > 0)),
    CONSTRAINT check_price_non_negative CHECK ((price_kobo >= 0)),
    CONSTRAINT check_sold_within_capacity CHECK (((sold <= capacity) AND (sold >= 0))),
    CONSTRAINT check_stock_consistency CHECK ((available = (capacity - sold))),
    CONSTRAINT ticket_tiers_stock_check CHECK ((available >= 0))
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    order_id uuid NOT NULL,
    event_id uuid NOT NULL,
    ticket_tier_id uuid NOT NULL,
    user_id uuid,
    status public.ticket_status DEFAULT 'active'::public.ticket_status NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_blacklist (
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(60) NOT NULL,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    reset_token character varying(255),
    reset_token_expiry timestamp with time zone,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    allow_reminder_emails boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN users.allow_reminder_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.allow_reminder_emails IS 'User preference for receiving subscription reminder emails. Payment confirmations are always sent regardless of this setting.';


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    image_url character varying(255) NOT NULL,
    status public.vendor_status DEFAULT 'draft'::public.vendor_status NOT NULL,
    is_identity_verified boolean DEFAULT false NOT NULL,
    is_business_registered boolean DEFAULT false NOT NULL,
    state character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    phone_number character varying(20) NOT NULL,
    min_price integer,
    pvs_score integer DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    profile_completion real DEFAULT 0.0 NOT NULL,
    inquiry_count integer DEFAULT 0 NOT NULL,
    responded_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vnin character varying(20) DEFAULT ''::character varying NOT NULL,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    last_name character varying(100) NOT NULL,
    description text NOT NULL,
    email character varying(255) NOT NULL,
    cac_number character varying(20) DEFAULT ''::character varying,
    is_business_verified boolean DEFAULT false,
    subscription_tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT check_subscription_tier CHECK (((subscription_tier)::text = ANY (ARRAY[('free'::character varying)::text, ('basic'::character varying)::text, ('premium'::character varying)::text, ('featured'::character varying)::text]))),
    CONSTRAINT check_valid_tier CHECK (((subscription_tier)::text = ANY (ARRAY[('free'::character varying)::text, ('basic'::character varying)::text, ('premium'::character varying)::text, ('featured'::character varying)::text])))
);


--
-- Name: TABLE vendors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendors IS 'Updated: Removed gender and date_of_birth columns as they are not required for vendor operations';


--
-- Name: v_subscriptions_needing_1d_reminder; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_subscriptions_needing_1d_reminder AS
 SELECT s.id AS subscription_id,
    s.vendor_id,
    s.tier,
    s.expires_at,
    s.price,
    s.currency,
    v.owner_id,
    v.name AS vendor_name,
    u.id AS user_id,
    u.email AS user_email,
    u.name AS user_name,
    u.allow_reminder_emails
   FROM ((public.subscriptions s
     JOIN public.vendors v ON ((s.vendor_id = v.id)))
     JOIN public.users u ON ((v.owner_id = u.id)))
  WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true) AND (s.reminder_1d_sent_at IS NULL) AND (s.expires_at <= (now() + '1 day'::interval)) AND (s.expires_at > now()) AND (u.allow_reminder_emails = true));


--
-- Name: v_subscriptions_needing_3d_reminder; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_subscriptions_needing_3d_reminder AS
 SELECT s.id AS subscription_id,
    s.vendor_id,
    s.tier,
    s.expires_at,
    s.price,
    s.currency,
    v.owner_id,
    v.name AS vendor_name,
    u.id AS user_id,
    u.email AS user_email,
    u.name AS user_name,
    u.allow_reminder_emails
   FROM ((public.subscriptions s
     JOIN public.vendors v ON ((s.vendor_id = v.id)))
     JOIN public.users u ON ((v.owner_id = u.id)))
  WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true) AND (s.reminder_3d_sent_at IS NULL) AND (s.expires_at <= (now() + '3 days'::interval)) AND (s.expires_at > (now() + '2 days'::interval)) AND (u.allow_reminder_emails = true));


--
-- Name: v_subscriptions_needing_7d_reminder; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_subscriptions_needing_7d_reminder AS
 SELECT s.id AS subscription_id,
    s.vendor_id,
    s.tier,
    s.expires_at,
    s.price,
    s.currency,
    v.owner_id,
    v.name AS vendor_name,
    u.id AS user_id,
    u.email AS user_email,
    u.name AS user_name,
    u.allow_reminder_emails
   FROM ((public.subscriptions s
     JOIN public.vendors v ON ((s.vendor_id = v.id)))
     JOIN public.users u ON ((v.owner_id = u.id)))
  WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true) AND (s.reminder_7d_sent_at IS NULL) AND (s.expires_at <= (now() + '7 days'::interval)) AND (s.expires_at > (now() + '6 days'::interval)) AND (u.allow_reminder_emails = true));


--
-- Name: v_subscriptions_needing_expired_notice; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_subscriptions_needing_expired_notice AS
 SELECT s.id AS subscription_id,
    s.vendor_id,
    s.tier,
    s.expires_at,
    s.price,
    s.currency,
    v.owner_id,
    v.name AS vendor_name,
    u.id AS user_id,
    u.email AS user_email,
    u.name AS user_name
   FROM ((public.subscriptions s
     JOIN public.vendors v ON ((s.vendor_id = v.id)))
     JOIN public.users u ON ((v.owner_id = u.id)))
  WHERE (((s.status)::text = 'expired'::text) AND (s.expired_notice_sent_at IS NULL));


--
-- Name: vendor_daily_metrics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.vendor_daily_metrics AS
 SELECT v.id AS vendor_id,
    v.name,
    v.category,
    count(DISTINCT
        CASE
            WHEN (i.created_at >= (now() - '7 days'::interval)) THEN i.id
            ELSE NULL::uuid
        END) AS inquiries_7d,
    count(DISTINCT
        CASE
            WHEN (r.created_at >= (now() - '7 days'::interval)) THEN r.id
            ELSE NULL::uuid
        END) AS reviews_7d,
    COALESCE(avg(
        CASE
            WHEN (r.created_at >= (now() - '7 days'::interval)) THEN r.rating
            ELSE NULL::smallint
        END), (0)::numeric) AS avg_rating_7d,
    count(DISTINCT
        CASE
            WHEN (i.created_at >= (now() - '30 days'::interval)) THEN i.id
            ELSE NULL::uuid
        END) AS inquiries_30d,
    count(DISTINCT
        CASE
            WHEN (r.created_at >= (now() - '30 days'::interval)) THEN r.id
            ELSE NULL::uuid
        END) AS reviews_30d,
    COALESCE(avg(
        CASE
            WHEN (r.created_at >= (now() - '30 days'::interval)) THEN r.rating
            ELSE NULL::smallint
        END), (0)::numeric) AS avg_rating_30d,
    count(DISTINCT i.id) AS total_inquiries,
    count(DISTINCT r.id) AS total_reviews,
    COALESCE(avg(r.rating), (0)::numeric) AS avg_rating_all,
    now() AS last_updated
   FROM ((public.vendors v
     LEFT JOIN public.inquiries i ON ((v.id = i.vendor_id)))
     LEFT JOIN public.reviews r ON ((v.id = r.vendor_id)))
  GROUP BY v.id, v.name, v.category
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW vendor_daily_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.vendor_daily_metrics IS 'Pre-computed vendor analytics metrics. Refreshed hourly via background job. 
Used by vendor analytics dashboard to avoid expensive real-time aggregations.';


--
-- Name: vendor_of_the_month; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.vendor_of_the_month AS
 WITH monthly_views AS (
         SELECT pv.vendor_id,
            count(*) AS view_count,
            date_trunc('month'::text, pv.viewed_at) AS month
           FROM public.profile_views pv
          WHERE (pv.viewed_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))
          GROUP BY pv.vendor_id, (date_trunc('month'::text, pv.viewed_at))
        )
 SELECT v.id AS vendor_id,
    v.name,
    v.category,
    v.state,
    v.city,
    v.subscription_tier,
    COALESCE(mv.view_count, (0)::bigint) AS monthly_views,
    v.pvs_score,
    v.review_count,
    row_number() OVER (ORDER BY COALESCE(mv.view_count, (0)::bigint) DESC, v.pvs_score DESC) AS overall_rank,
    row_number() OVER (PARTITION BY v.category ORDER BY COALESCE(mv.view_count, (0)::bigint) DESC, v.pvs_score DESC) AS category_rank,
    row_number() OVER (PARTITION BY v.state, v.city ORDER BY COALESCE(mv.view_count, (0)::bigint) DESC, v.pvs_score DESC) AS location_rank,
    now() AS last_updated
   FROM (public.vendors v
     LEFT JOIN monthly_views mv ON ((v.id = mv.vendor_id)))
  WHERE ((v.status = 'active'::public.vendor_status) AND ((v.subscription_tier)::text = ANY (ARRAY[('premium'::character varying)::text, ('featured'::character varying)::text])))
  WITH NO DATA;


--
-- Name: vendor_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_stats (
    vendor_id uuid NOT NULL,
    views_30d integer DEFAULT 0,
    views_total bigint DEFAULT 0,
    category_rank integer DEFAULT 0,
    location_rank integer DEFAULT 0,
    total_in_category integer DEFAULT 0,
    total_in_location integer DEFAULT 0,
    category_percentile numeric(5,4) DEFAULT 0,
    composite_score numeric(10,2) DEFAULT 0,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: vendor_trust_score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_trust_score (
    vendor_id uuid NOT NULL,
    total_trust_weight numeric(10,2) DEFAULT 0.00 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_outbox email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);


--
-- Name: events events_event_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_event_slug_key UNIQUE (event_slug);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (email);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_reference_key UNIQUE (reference);


--
-- Name: payments payments_gateway_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gateway_reference_key UNIQUE (gateway_reference);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profile_views profile_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT profile_views_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (reference);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: ticket_tiers ticket_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tiers
    ADD CONSTRAINT ticket_tiers_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_code_key UNIQUE (code);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (token_hash);


--
-- Name: subscriptions unique_payment_reference; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT unique_payment_reference UNIQUE (payment_reference);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_stats vendor_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_stats
    ADD CONSTRAINT vendor_stats_pkey PRIMARY KEY (vendor_id);


--
-- Name: vendor_trust_score vendor_trust_score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_trust_score
    ADD CONSTRAINT vendor_trust_score_pkey PRIMARY KEY (vendor_id);


--
-- Name: vendors vendors_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_owner_id_key UNIQUE (owner_id);


--
-- Name: vendors vendors_owner_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_owner_id_unique UNIQUE (owner_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_email_outbox_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_outbox_status ON public.email_outbox USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_events_active_discovery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_active_discovery ON public.events USING btree (start_date) WHERE (is_deleted = false);


--
-- Name: idx_events_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_category ON public.events USING btree (category);


--
-- Name: idx_events_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_date ON public.events USING btree (start_date);


--
-- Name: idx_events_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_deleted_at ON public.events USING btree (deleted_at) WHERE (is_deleted = true);


--
-- Name: idx_events_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_location ON public.events USING btree (state, city);


--
-- Name: idx_events_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_organizer ON public.events USING btree (organizer_id);


--
-- Name: idx_events_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_events_slug ON public.events USING btree (event_slug) WHERE (event_slug IS NOT NULL);


--
-- Name: idx_events_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_slug_active ON public.events USING btree (event_slug) WHERE (is_deleted = false);


--
-- Name: idx_events_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date) WHERE (is_deleted = false);


--
-- Name: idx_events_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_status_date ON public.events USING btree (is_deleted, start_date) WHERE (is_deleted = false);


--
-- Name: idx_events_tags_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_tags_gin ON public.events USING gin (tags);


--
-- Name: idx_feedback_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_created_at ON public.feedback USING btree (created_at);


--
-- Name: idx_feedback_guest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_guest_id ON public.feedback USING btree (guest_id);


--
-- Name: idx_feedback_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_type ON public.feedback USING btree (type);


--
-- Name: idx_feedback_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);


--
-- Name: idx_inquiries_guest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_guest_id ON public.inquiries USING btree (guest_id);


--
-- Name: idx_inquiries_trust_signal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_trust_signal ON public.inquiries USING btree (vendor_id, user_id, ip_address);


--
-- Name: idx_inquiries_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_user_id ON public.inquiries USING btree (user_id);


--
-- Name: idx_inquiries_vendor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_vendor_created ON public.inquiries USING btree (vendor_id, created_at DESC);


--
-- Name: idx_inquiries_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_vendor_id ON public.inquiries USING btree (vendor_id);


--
-- Name: idx_login_attempts_last_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_attempts_last_attempt ON public.login_attempts USING btree (last_attempt_at);


--
-- Name: idx_order_items_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_event_id ON public.order_items USING btree (event_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_ticket_tier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_ticket_tier_id ON public.order_items USING btree (ticket_tier_id);


--
-- Name: idx_orders_event_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_event_status_date ON public.orders USING btree (status, created_at);


--
-- Name: idx_orders_guest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_guest_id ON public.orders USING btree (guest_id);


--
-- Name: idx_orders_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_reference ON public.orders USING btree (reference);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_payments_gateway_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_payments_gateway_reference ON public.payments USING btree (gateway_reference);


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_profile_views_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_dedupe ON public.profile_views USING btree (vendor_id, session_id, viewer_ip, viewed_at DESC);


--
-- Name: idx_profile_views_ip_vendor_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_ip_vendor_time ON public.profile_views USING btree (viewer_ip, vendor_id, viewed_at DESC);


--
-- Name: idx_profile_views_session_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_session_vendor ON public.profile_views USING btree (session_id, vendor_id);


--
-- Name: idx_profile_views_user_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_user_vendor ON public.profile_views USING btree (viewer_id, vendor_id, viewed_at DESC) WHERE (viewer_id IS NOT NULL);


--
-- Name: idx_profile_views_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_vendor ON public.profile_views USING btree (vendor_id);


--
-- Name: idx_profile_views_vendor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_vendor_date ON public.profile_views USING btree (vendor_id, date(viewed_at));


--
-- Name: idx_profile_views_viewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_views_viewed_at ON public.profile_views USING btree (viewed_at DESC);


--
-- Name: idx_reviews_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_email ON public.reviews USING btree (email);


--
-- Name: idx_reviews_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_email_lower ON public.reviews USING btree (lower((email)::text));


--
-- Name: idx_reviews_one_per_user_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reviews_one_per_user_vendor ON public.reviews USING btree (vendor_id, COALESCE((user_id)::text, (ip_address)::text));


--
-- Name: idx_reviews_trust_check; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_trust_check ON public.reviews USING btree (email, vendor_id);


--
-- Name: idx_reviews_vendor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_vendor_created ON public.reviews USING btree (vendor_id, created_at DESC);


--
-- Name: idx_reviews_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_vendor_id ON public.reviews USING btree (vendor_id);


--
-- Name: idx_reviews_vendor_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_vendor_rating ON public.reviews USING btree (vendor_id, rating);


--
-- Name: idx_reviews_vendor_trust; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_vendor_trust ON public.reviews USING btree (vendor_id, trust_weight);


--
-- Name: idx_sp_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sp_needs_review ON public.subscription_payments USING btree (created_at) WHERE ((status)::text = 'needs_review'::text);


--
-- Name: idx_sp_stale_initiated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sp_stale_initiated ON public.subscription_payments USING btree (created_at) WHERE ((status)::text = 'initiated'::text);


--
-- Name: idx_sp_vendor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sp_vendor_created ON public.subscription_payments USING btree (vendor_id, created_at DESC);


--
-- Name: idx_stats_cat_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_cat_lookup ON public.vendor_stats USING btree (category_rank) WHERE (category_rank > 0);


--
-- Name: idx_stats_composite_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stats_composite_score ON public.vendor_stats USING btree (composite_score DESC);


--
-- Name: idx_subscriptions_1d_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_1d_reminder ON public.subscriptions USING btree (expires_at, reminder_1d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_1d_sent_at IS NULL));


--
-- Name: idx_subscriptions_3d_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_3d_reminder ON public.subscriptions USING btree (expires_at, reminder_3d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_3d_sent_at IS NULL));


--
-- Name: idx_subscriptions_7d_reminder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_7d_reminder ON public.subscriptions USING btree (expires_at, reminder_7d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_7d_sent_at IS NULL));


--
-- Name: idx_subscriptions_expired_notice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expired_notice ON public.subscriptions USING btree (status, expired_notice_sent_at) WHERE (((status)::text = 'expired'::text) AND (expired_notice_sent_at IS NULL));


--
-- Name: idx_subscriptions_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expiry ON public.subscriptions USING btree (expires_at) WHERE (((status)::text = 'active'::text) AND (expires_at IS NOT NULL));


--
-- Name: idx_subscriptions_expiry_reminders; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expiry_reminders ON public.subscriptions USING btree (expires_at, status, auto_renew) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_payment_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_payment_ref ON public.subscriptions USING btree (payment_reference) WHERE (payment_reference IS NOT NULL);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_status_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status_expiry ON public.subscriptions USING btree (status, expires_at) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_tier ON public.subscriptions USING btree (tier);


--
-- Name: idx_subscriptions_unique_active_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_subscriptions_unique_active_vendor ON public.subscriptions USING btree (vendor_id) WHERE ((status)::text = 'active'::text);


--
-- Name: INDEX idx_subscriptions_unique_active_vendor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_subscriptions_unique_active_vendor IS 'Ensures only one active subscription per vendor at a time. Prevents duplicate active subscriptions.';


--
-- Name: idx_subscriptions_vendor_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_vendor_active ON public.subscriptions USING btree (vendor_id, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_subscriptions_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_vendor_id ON public.subscriptions USING btree (vendor_id);


--
-- Name: idx_subscriptions_vendor_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_vendor_latest ON public.subscriptions USING btree (vendor_id, created_at DESC);


--
-- Name: idx_ticket_tiers_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_tiers_event_id ON public.ticket_tiers USING btree (event_id);


--
-- Name: idx_ticket_tiers_event_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_tiers_event_tier ON public.ticket_tiers USING btree (event_id, name);


--
-- Name: idx_tickets_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tickets_code ON public.tickets USING btree (code);


--
-- Name: idx_tickets_event_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_event_id_status ON public.tickets USING btree (event_id, status);


--
-- Name: idx_tickets_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_order_id ON public.tickets USING btree (order_id);


--
-- Name: idx_tickets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_user_id ON public.tickets USING btree (user_id);


--
-- Name: idx_tiers_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tiers_event_id ON public.ticket_tiers USING btree (event_id);


--
-- Name: idx_token_blacklist_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_blacklist_expiry ON public.token_blacklist USING btree (expires_at);


--
-- Name: idx_tokens_expires_at_revoked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tokens_expires_at_revoked ON public.refresh_tokens USING btree (expires_at, revoked);


--
-- Name: idx_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_unique_user_vendor_review; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_user_vendor_review ON public.reviews USING btree (vendor_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_reminder_prefs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_reminder_prefs ON public.users USING btree (allow_reminder_emails) WHERE (allow_reminder_emails = true);


--
-- Name: idx_users_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_reset_token ON public.users USING btree (reset_token);


--
-- Name: idx_vendor_daily_metrics_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_daily_metrics_category ON public.vendor_daily_metrics USING btree (category);


--
-- Name: idx_vendor_daily_metrics_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_daily_metrics_updated ON public.vendor_daily_metrics USING btree (last_updated DESC);


--
-- Name: idx_vendor_daily_metrics_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendor_daily_metrics_vendor_id ON public.vendor_daily_metrics USING btree (vendor_id);


--
-- Name: idx_vendor_month_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_month_category ON public.vendor_of_the_month USING btree (category, category_rank);


--
-- Name: idx_vendor_month_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendor_month_id ON public.vendor_of_the_month USING btree (vendor_id);


--
-- Name: idx_vendor_month_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_month_location ON public.vendor_of_the_month USING btree (state, city, location_rank);


--
-- Name: idx_vendor_month_overall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_month_overall ON public.vendor_of_the_month USING btree (overall_rank);


--
-- Name: idx_vendor_of_the_month_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendor_of_the_month_vendor_id ON public.vendor_of_the_month USING btree (vendor_id);


--
-- Name: idx_vendors_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_category ON public.vendors USING btree (category);


--
-- Name: idx_vendors_category_state_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_category_state_status ON public.vendors USING btree (category, state, status);


--
-- Name: idx_vendors_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_created ON public.vendors USING btree (created_at DESC);


--
-- Name: idx_vendors_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_deleted_at ON public.vendors USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_vendors_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_id ON public.vendors USING btree (id);


--
-- Name: idx_vendors_leaderboard_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_leaderboard_lookup ON public.vendors USING btree (category, state, city) WHERE (status = 'active'::public.vendor_status);


--
-- Name: idx_vendors_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_location ON public.vendors USING btree (state, city);


--
-- Name: idx_vendors_min_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_min_price ON public.vendors USING btree (min_price);


--
-- Name: idx_vendors_pvs_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_pvs_score ON public.vendors USING btree (pvs_score DESC);


--
-- Name: idx_vendors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_status ON public.vendors USING btree (status);


--
-- Name: idx_vendors_subscription_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_subscription_tier ON public.vendors USING btree (subscription_tier);


--
-- Name: events events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feedback feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inquiries inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reviews reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_tiers ticket_tiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ticket_tiers_updated_at BEFORE UPDATE ON public.ticket_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tickets tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inquiries trg_after_inquiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_after_inquiry AFTER INSERT OR DELETE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.trg_update_trust_score_on_inquiry_change();


--
-- Name: reviews trg_after_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_after_review AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.trg_update_trust_score_on_review_change();


--
-- Name: inquiries trg_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ticket_tiers trg_lock_price_on_sales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lock_price_on_sales BEFORE UPDATE ON public.ticket_tiers FOR EACH ROW EXECUTE FUNCTION public.protect_sold_ticket_prices();


--
-- Name: subscription_payments trg_sp_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sp_updated_at BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profile_views trigger_cleanup_old_views; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_old_views AFTER INSERT ON public.profile_views FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_profile_views();


--
-- Name: TRIGGER trigger_cleanup_old_views ON profile_views; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_cleanup_old_views ON public.profile_views IS 'Periodically removes profile views older than 90 days to prevent table bloat';


--
-- Name: subscriptions trigger_sync_vendor_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_vendor_tier AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_subscription_tier();


--
-- Name: subscriptions trigger_update_subscriptions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_subscriptions_timestamp BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_subscriptions_updated_at();


--
-- Name: TRIGGER trigger_update_subscriptions_timestamp ON subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_update_subscriptions_timestamp ON public.subscriptions IS 'Automatically updates updated_at timestamp on every row modification';


--
-- Name: subscriptions trigger_validate_activation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_activation BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_activation();


--
-- Name: TRIGGER trigger_validate_activation ON subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_validate_activation ON public.subscriptions IS 'Prevents activating subscription without valid payment reference and expiry date';


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events events_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: order_items fk_order_items_event; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: reviews fk_review_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews fk_review_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_review_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: profile_views fk_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT fk_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: subscriptions fk_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT fk_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: inquiries inquiries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_ticket_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_ticket_tier_id_fkey FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: subscription_payments subscription_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE RESTRICT;


--
-- Name: ticket_tiers ticket_tiers_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tiers
    ADD CONSTRAINT ticket_tiers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_ticket_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_tier_id_fkey FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vendor_stats vendor_stats_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_stats
    ADD CONSTRAINT vendor_stats_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_trust_score vendor_trust_score_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_trust_score
    ADD CONSTRAINT vendor_trust_score_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendors vendors_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jKxFl2baYJW7xRpIRATY5Owey2z5OHN9NC9fa6Vy7bQpWsFXvRbb9XnESk3f2Cx

