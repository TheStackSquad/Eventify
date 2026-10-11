-- Eventify database schema
-- Auto-runs on first boot via /docker-entrypoint-initdb.d/
-- Generated from pg_dump --schema-only --no-owner --no-privileges

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

CREATE TYPE public.event_type AS ENUM ('physical', 'virtual');
CREATE TYPE public.feedback_type AS ENUM ('suggestion', 'complaint', 'feedback');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'success', 'failed', 'refunded', 'fraud', 'expired');
CREATE TYPE public.ticket_status AS ENUM ('active', 'used', 'canceled', 'cancelled');
CREATE TYPE public.user_role AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE public.vendor_status AS ENUM ('draft', 'pending_approval', 'active', 'suspended');

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.cleanup_old_profile_views() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT COUNT(*) FROM profile_views) % 1000 = 0 THEN
        DELETE FROM profile_views WHERE viewed_at < NOW() - INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.cleanup_profile_views_90d() RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    DELETE FROM profile_views WHERE viewed_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$;

COMMENT ON FUNCTION public.cleanup_profile_views_90d() IS
    'Batch cleanup for views older than 90 days. Run nightly via cron: SELECT cleanup_profile_views_90d();';

CREATE FUNCTION public.expire_old_subscriptions() RETURNS TABLE(expired_count integer)
    LANGUAGE plpgsql AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE subscriptions SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$;

COMMENT ON FUNCTION public.expire_old_subscriptions() IS
    'Batch job to expire subscriptions past their expiry date. Run daily via cron.';

CREATE FUNCTION public.fn_calc_vendor_trust_score(vendor_uuid uuid) RETURNS void
    LANGUAGE plpgsql AS $$
BEGIN
    WITH review_sum AS (
        SELECT COALESCE(SUM(r.trust_weight), 0) AS total_review_weight,
               COALESCE(COUNT(r.id), 0) AS review_count
        FROM reviews r WHERE r.vendor_id = vendor_uuid
    ),
    inquiry_sum AS (
        SELECT COALESCE(SUM(i.trust_weight), 0) AS total_inquiry_weight
        FROM inquiries i WHERE i.vendor_id = vendor_uuid
    )
    INSERT INTO vendor_trust_score (vendor_id, total_trust_weight, review_count, updated_at)
    SELECT vendor_uuid, rs.total_review_weight + isum.total_inquiry_weight, rs.review_count, NOW()
    FROM review_sum rs, inquiry_sum isum
    ON CONFLICT (vendor_id) DO UPDATE SET
        total_trust_weight = EXCLUDED.total_trust_weight,
        review_count       = EXCLUDED.review_count,
        updated_at         = EXCLUDED.updated_at;
END;
$$;

CREATE FUNCTION public.get_profile_view_count_30d(p_vendor_id uuid) RETURNS integer
    LANGUAGE plpgsql AS $$
DECLARE view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO view_count FROM profile_views
    WHERE vendor_id = p_vendor_id AND viewed_at > NOW() - INTERVAL '30 days';
    RETURN COALESCE(view_count, 0);
END;
$$;

CREATE FUNCTION public.get_recent_profile_views(p_vendor_id uuid, p_limit integer DEFAULT 100, p_days integer DEFAULT 30)
    RETURNS TABLE(view_id uuid, viewer_id uuid, viewer_ip character varying, session_id character varying, user_agent text, viewed_at timestamp without time zone)
    LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT pv.id, pv.viewer_id, pv.viewer_ip, pv.session_id, pv.user_agent, pv.viewed_at
    FROM profile_views pv
    WHERE pv.vendor_id = p_vendor_id AND pv.viewed_at > NOW() - (p_days || ' days')::INTERVAL
    ORDER BY pv.viewed_at DESC LIMIT p_limit;
END;
$$;

CREATE FUNCTION public.get_vendor_active_subscription(p_vendor_id uuid)
    RETURNS TABLE(id uuid, tier character varying, status character varying, expires_at timestamp without time zone)
    LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.tier, s.status, s.expires_at FROM subscriptions s
    WHERE s.vendor_id = p_vendor_id AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1;
END;
$$;

CREATE FUNCTION public.protect_sold_ticket_prices() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.sold > 0 AND OLD.price_kobo IS DISTINCT FROM NEW.price_kobo THEN
        RAISE EXCEPTION 'cannot change price of a tier that has existing sales';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.record_profile_view(
    p_vendor_id uuid, p_viewer_id uuid, p_viewer_ip character varying,
    p_session_id character varying, p_user_agent text DEFAULT NULL::text
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
    rows_inserted INTEGER := 0;
    hours_ago_24 TIMESTAMP := NOW() - INTERVAL '24 hours';
    hours_ago_6  TIMESTAMP := NOW() - INTERVAL '6 hours';
BEGIN
    IF p_session_id IS NULL OR p_session_id = '' THEN
        RAISE EXCEPTION 'session_id cannot be null or empty';
    END IF;
    IF p_viewer_ip IS NULL OR p_viewer_ip = '' THEN
        RAISE EXCEPTION 'viewer_ip cannot be null or empty';
    END IF;
    INSERT INTO profile_views (vendor_id, viewer_id, viewer_ip, session_id, user_agent)
    SELECT p_vendor_id, p_viewer_id, p_viewer_ip, p_session_id, p_user_agent
    WHERE NOT EXISTS (
        SELECT 1 FROM profile_views
        WHERE vendor_id = p_vendor_id AND (
            (session_id = p_session_id)
            OR (viewer_ip = p_viewer_ip AND viewed_at > hours_ago_24)
            OR (viewer_id = p_viewer_id AND viewer_id IS NOT NULL AND viewed_at > hours_ago_6)
        )
    );
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted > 0;
EXCEPTION
    WHEN unique_violation THEN RETURN FALSE;
    WHEN OTHERS THEN RAISE;
END;
$$;

CREATE FUNCTION public.refresh_vendor_analytics() RETURNS void
    LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_daily_metrics;
    RAISE NOTICE 'vendor_daily_metrics refreshed at %', NOW();
END;
$$;

CREATE FUNCTION public.sync_vendor_subscription_tier() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'active' AND (NEW.expires_at IS NULL OR NEW.expires_at > NOW()) THEN
        UPDATE vendors SET subscription_tier = NEW.tier, updated_at = NOW() WHERE id = NEW.vendor_id;
    ELSIF NEW.status IN ('expired', 'cancelled') OR (NEW.expires_at IS NOT NULL AND NEW.expires_at <= NOW()) THEN
        IF NOT EXISTS (
            SELECT 1 FROM subscriptions
            WHERE vendor_id = NEW.vendor_id AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW()) AND id != NEW.id
        ) THEN
            UPDATE vendors SET subscription_tier = 'free', updated_at = NOW() WHERE id = NEW.vendor_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.trg_update_trust_score_on_inquiry_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN PERFORM FN_CALC_VENDOR_TRUST_SCORE(NEW.vendor_id);
    ELSIF TG_OP = 'DELETE' THEN PERFORM FN_CALC_VENDOR_TRUST_SCORE(OLD.vendor_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.trg_update_trust_score_on_review_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN PERFORM FN_CALC_VENDOR_TRUST_SCORE(NEW.vendor_id);
    ELSIF TG_OP = 'DELETE' THEN PERFORM FN_CALC_VENDOR_TRUST_SCORE(OLD.vendor_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.update_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$;

CREATE FUNCTION public.validate_subscription_activation() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        IF NEW.payment_reference IS NULL OR NEW.payment_reference = '' THEN
            RAISE EXCEPTION 'Cannot activate subscription without payment_reference';
        END IF;
        IF NEW.expires_at IS NULL THEN
            RAISE EXCEPTION 'Cannot activate subscription without expires_at date';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE public.users (
    id                   uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name                 character varying(255) NOT NULL,
    email                character varying(255) NOT NULL,
    password_hash        character varying(60) NOT NULL,
    role                 public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    reset_token          character varying(255),
    reset_token_expiry   timestamp with time zone,
    last_login           timestamp with time zone,
    created_at           timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    allow_reminder_emails boolean DEFAULT true NOT NULL
);

COMMENT ON COLUMN public.users.allow_reminder_emails IS
    'User preference for receiving subscription reminder emails. Payment confirmations are always sent regardless of this setting.';

CREATE TABLE public.vendors (
    id                      uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id                uuid NOT NULL,
    name                    character varying(255) NOT NULL,
    category                character varying(100) NOT NULL,
    image_url               character varying(255) DEFAULT ''::character varying NOT NULL,
    status                  public.vendor_status DEFAULT 'draft'::public.vendor_status NOT NULL,
    is_identity_verified    boolean DEFAULT false NOT NULL,
    is_business_registered  boolean DEFAULT false NOT NULL,
    state                   character varying(100) NOT NULL,
    city                    character varying(100) DEFAULT ''::character varying NOT NULL,
    phone_number            character varying(20) DEFAULT ''::character varying NOT NULL,
    min_price               integer,
    pvs_score               integer DEFAULT 0 NOT NULL,
    review_count            integer DEFAULT 0 NOT NULL,
    profile_completion      real DEFAULT 0.0 NOT NULL,
    inquiry_count           integer DEFAULT 0 NOT NULL,
    responded_count         integer DEFAULT 0 NOT NULL,
    created_at              timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vnin                    character varying(20) DEFAULT ''::character varying NOT NULL,
    first_name              character varying(100) DEFAULT ''::character varying NOT NULL,
    middle_name             character varying(100),
    last_name               character varying(100) DEFAULT ''::character varying NOT NULL,
    description             text DEFAULT ''::text NOT NULL,
    email                   character varying(255) DEFAULT ''::character varying NOT NULL,
    cac_number              character varying(20) DEFAULT ''::character varying,
    is_business_verified    boolean DEFAULT false,
    subscription_tier       character varying(20) DEFAULT 'free'::character varying NOT NULL,
    deleted_at              timestamp with time zone,
    CONSTRAINT check_subscription_tier CHECK (((subscription_tier)::text = ANY ((ARRAY['free'::character varying, 'basic'::character varying, 'premium'::character varying, 'featured'::character varying])::text[]))),
    CONSTRAINT check_valid_tier        CHECK (((subscription_tier)::text = ANY ((ARRAY['free'::character varying, 'basic'::character varying, 'premium'::character varying, 'featured'::character varying])::text[])))
);

CREATE TABLE public.events (
    id                      uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organizer_id            uuid NOT NULL,
    event_title             character varying(255) NOT NULL,
    event_description       text NOT NULL,
    event_slug              character varying(255),
    category                character varying(100) NOT NULL,
    event_type              public.event_type NOT NULL,
    event_image_url         character varying(255) NOT NULL,
    venue_name              character varying(255) NOT NULL,
    venue_address           character varying(255),
    city                    character varying(100) NOT NULL,
    state                   character varying(100) NOT NULL,
    country                 character varying(100),
    virtual_platform        character varying(100),
    meeting_link            character varying(255),
    start_date              timestamp with time zone NOT NULL,
    end_date                timestamp with time zone NOT NULL,
    max_attendees           integer,
    paystack_subaccount_code character varying(100),
    tags                    text[],
    is_deleted              boolean DEFAULT false NOT NULL,
    deleted_at              timestamp with time zone,
    created_at              timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at              timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_category_not_empty    CHECK (((category)::text <> ''::text)),
    CONSTRAINT check_event_description_not_empty CHECK ((event_description <> ''::text)),
    CONSTRAINT check_event_title_not_empty CHECK (((event_title)::text <> ''::text)),
    CONSTRAINT chk_category_not_empty     CHECK ((length(TRIM(BOTH FROM category)) > 0)),
    CONSTRAINT chk_description_not_empty  CHECK ((length(TRIM(BOTH FROM event_description)) > 0)),
    CONSTRAINT chk_end_after_start        CHECK ((end_date >= start_date)),
    CONSTRAINT chk_max_attendees_positive CHECK (((max_attendees IS NULL) OR (max_attendees > 0))),
    CONSTRAINT chk_title_not_empty        CHECK ((length(TRIM(BOTH FROM event_title)) > 0))
);

CREATE TABLE public.ticket_tiers (
    id          uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id    uuid NOT NULL,
    name        character varying(100) CONSTRAINT ticket_tiers_tier_name_not_null NOT NULL,
    price_kobo  integer DEFAULT 0 CONSTRAINT ticket_tiers_price_not_null NOT NULL,
    capacity    integer CONSTRAINT ticket_tiers_quantity_not_null NOT NULL,
    description character varying(255),
    sold        integer DEFAULT 0 CONSTRAINT ticket_tiers_tickets_sold_not_null NOT NULL,
    created_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    available   integer NOT NULL,
    CONSTRAINT check_available_non_negative CHECK ((available >= 0)),
    CONSTRAINT check_capacity_positive      CHECK ((capacity > 0)),
    CONSTRAINT check_price_non_negative     CHECK ((price_kobo >= 0)),
    CONSTRAINT check_sold_within_capacity   CHECK (((sold <= capacity) AND (sold >= 0))),
    CONSTRAINT check_stock_consistency      CHECK ((available = (capacity - sold))),
    CONSTRAINT ticket_tiers_stock_check     CHECK ((available >= 0))
);

CREATE TABLE public.orders (
    id                   uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id              uuid,
    reference            character varying(255) NOT NULL,
    status               public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    subtotal             integer NOT NULL,
    service_fee          integer NOT NULL,
    vat_amount           integer NOT NULL,
    final_total          integer NOT NULL,
    amount_paid          integer DEFAULT 0 NOT NULL,
    payment_channel      character varying(100),
    paid_at              timestamp with time zone,
    customer_email       character varying(255) NOT NULL,
    customer_first_name  character varying(255) NOT NULL,
    customer_last_name   character varying(255) NOT NULL,
    customer_phone       character varying(20),
    ip_address           character varying(45),
    user_agent           character varying(255),
    processed_by         character varying(255),
    webhook_attempts     integer DEFAULT 0 NOT NULL,
    created_at           timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id             character varying(255),
    paystack_fee         bigint DEFAULT 0,
    app_profit           bigint DEFAULT 0
);

COMMENT ON TABLE public.orders IS 'Order items with complete event snapshot at time of purchase. Event fields are denormalized for historical integrity.';

CREATE TABLE public.order_items (
    id              uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id        uuid NOT NULL,
    event_title     character varying(255) NOT NULL,
    event_id        uuid NOT NULL,
    ticket_tier_id  uuid NOT NULL,
    tier_name       character varying(100) NOT NULL,
    quantity        integer NOT NULL,
    unit_price      integer NOT NULL,
    subtotal        integer NOT NULL,
    created_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event_start_date timestamp without time zone,
    event_end_date  timestamp without time zone,
    event_city      character varying(255),
    event_state     character varying(100),
    event_venue     character varying(255),
    event_address   text,
    event_thumbnail text
);

CREATE TABLE public.tickets (
    id             uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code           character varying(100) NOT NULL,
    order_id       uuid NOT NULL,
    event_id       uuid NOT NULL,
    ticket_tier_id uuid NOT NULL,
    user_id        uuid,
    status         public.ticket_status DEFAULT 'active'::public.ticket_status NOT NULL,
    is_used        boolean DEFAULT false NOT NULL,
    used_at        timestamp with time zone,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.payments (
    id                  uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id            uuid NOT NULL,
    gateway_tx_id       character varying(255),
    gateway_reference   character varying(255) NOT NULL,
    amount_paid         integer NOT NULL,
    fees_paid           integer DEFAULT 0 NOT NULL,
    currency            character varying(10) NOT NULL,
    status              character varying(50) NOT NULL,
    gateway_response    character varying(255),
    channel             character varying(100),
    ip_address          character varying(45),
    paid_at             timestamp with time zone,
    created_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.refresh_tokens (
    id          uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id     uuid NOT NULL,
    token_hash  text NOT NULL,
    revoked     boolean DEFAULT false NOT NULL,
    expires_at  timestamp with time zone NOT NULL,
    created_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    consumed_at timestamp with time zone,
    parent_id   uuid,
    ip_address  inet,
    user_agent  text
);

CREATE TABLE public.token_blacklist (
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.feedback (
    id         uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id    uuid,
    type       public.feedback_type NOT NULL,
    message    text NOT NULL,
    image_url  character varying(255),
    name       character varying(255) NOT NULL,
    email      character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id   character varying(255)
);

CREATE TABLE public.inquiries (
    id           uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id    uuid NOT NULL,
    user_id      uuid,
    name         character varying(255) NOT NULL,
    email        character varying(255) NOT NULL,
    message      text NOT NULL,
    ip_address   character varying(45),
    created_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    guest_id     character varying(255),
    trust_weight numeric(3,2) DEFAULT 1.00 NOT NULL
);

CREATE TABLE public.reviews (
    id           uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id    uuid NOT NULL,
    user_id      uuid,
    rating       smallint NOT NULL,
    comment      text NOT NULL,
    ip_address   character varying(45),
    created_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_name    character varying(255) NOT NULL,
    email        character varying(255) NOT NULL,
    is_verified  boolean DEFAULT false,
    trust_weight numeric(3,2) DEFAULT 5.00,
    CONSTRAINT check_rating_range  CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE public.subscriptions (
    id                      uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id               uuid NOT NULL,
    tier                    character varying(20) NOT NULL,
    status                  character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    starts_at               timestamp without time zone DEFAULT now() NOT NULL,
    expires_at              timestamp without time zone,
    auto_renew              boolean DEFAULT false NOT NULL,
    price                   bigint NOT NULL,
    currency                character varying(3) DEFAULT 'NGN'::character varying NOT NULL,
    payment_reference       character varying(255),
    payment_method          character varying(50),
    last_payment_date       timestamp without time zone,
    next_payment_date       timestamp without time zone,
    created_at              timestamp without time zone DEFAULT now() NOT NULL,
    updated_at              timestamp without time zone DEFAULT now() NOT NULL,
    webhook_attempts        integer DEFAULT 0,
    reminder_7d_sent_at     timestamp with time zone,
    reminder_3d_sent_at     timestamp with time zone,
    reminder_1d_sent_at     timestamp with time zone,
    payment_success_sent_at timestamp with time zone,
    expired_notice_sent_at  timestamp with time zone,
    CONSTRAINT valid_currency CHECK (((currency)::text ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT valid_price    CHECK ((price >= 0)),
    CONSTRAINT valid_status   CHECK (((status)::text = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'cancelled'::text]))),
    CONSTRAINT valid_tier     CHECK (((tier)::text = ANY ((ARRAY['free'::character varying, 'basic'::character varying, 'premium'::character varying, 'featured'::character varying])::text[])))
);

CREATE TABLE public.profile_views (
    id         uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id  uuid NOT NULL,
    viewer_id  uuid,
    viewer_ip  character varying(45) NOT NULL,
    user_agent text,
    session_id character varying(255) NOT NULL,
    viewed_at  timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_ip         CHECK (((viewer_ip IS NOT NULL) AND ((viewer_ip)::text <> ''::text))),
    CONSTRAINT valid_session_id CHECK (((session_id IS NOT NULL) AND ((session_id)::text <> ''::text)))
);

CREATE TABLE public.login_attempts (
    email           character varying(255) NOT NULL,
    failed_attempts integer DEFAULT 0,
    last_attempt_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.email_outbox (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email text NOT NULL,
    subject         text NOT NULL,
    template_type   text NOT NULL,
    payload         jsonb NOT NULL,
    status          text DEFAULT 'pending'::text,
    retry_count     integer DEFAULT 0,
    created_at      timestamp with time zone DEFAULT now(),
    processed_at    timestamp with time zone
);

CREATE TABLE public.vendor_stats (
    vendor_id           uuid NOT NULL,
    views_30d           integer DEFAULT 0,
    views_total         bigint DEFAULT 0,
    category_rank       integer DEFAULT 0,
    location_rank       integer DEFAULT 0,
    total_in_category   integer DEFAULT 0,
    total_in_location   integer DEFAULT 0,
    category_percentile numeric(5,4) DEFAULT 0,
    composite_score     numeric(10,2) DEFAULT 0,
    updated_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.vendor_trust_score (
    vendor_id         uuid NOT NULL,
    total_trust_weight numeric(10,2) DEFAULT 0.00 NOT NULL,
    review_count      integer DEFAULT 0 NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- Primary keys & unique constraints
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.email_outbox      ADD CONSTRAINT email_outbox_pkey           PRIMARY KEY (id);
ALTER TABLE ONLY public.events            ADD CONSTRAINT events_pkey                  PRIMARY KEY (id);
ALTER TABLE ONLY public.events            ADD CONSTRAINT events_event_slug_key        UNIQUE (event_slug);
ALTER TABLE ONLY public.feedback          ADD CONSTRAINT feedback_pkey                PRIMARY KEY (id);
ALTER TABLE ONLY public.inquiries         ADD CONSTRAINT inquiries_pkey               PRIMARY KEY (id);
ALTER TABLE ONLY public.login_attempts    ADD CONSTRAINT login_attempts_pkey          PRIMARY KEY (email);
ALTER TABLE ONLY public.order_items       ADD CONSTRAINT order_items_pkey             PRIMARY KEY (id);
ALTER TABLE ONLY public.orders            ADD CONSTRAINT orders_pkey                  PRIMARY KEY (id);
ALTER TABLE ONLY public.orders            ADD CONSTRAINT orders_reference_key         UNIQUE (reference);
ALTER TABLE ONLY public.payments          ADD CONSTRAINT payments_pkey                PRIMARY KEY (id);
ALTER TABLE ONLY public.payments          ADD CONSTRAINT payments_gateway_reference_key UNIQUE (gateway_reference);
ALTER TABLE ONLY public.profile_views     ADD CONSTRAINT profile_views_pkey           PRIMARY KEY (id);
ALTER TABLE ONLY public.refresh_tokens    ADD CONSTRAINT refresh_tokens_pkey          PRIMARY KEY (id);
ALTER TABLE ONLY public.reviews           ADD CONSTRAINT reviews_pkey                 PRIMARY KEY (id);
ALTER TABLE ONLY public.subscriptions     ADD CONSTRAINT subscriptions_pkey           PRIMARY KEY (id);
ALTER TABLE ONLY public.subscriptions     ADD CONSTRAINT unique_payment_reference     UNIQUE (payment_reference);
ALTER TABLE ONLY public.ticket_tiers      ADD CONSTRAINT ticket_tiers_pkey            PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets           ADD CONSTRAINT tickets_pkey                 PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets           ADD CONSTRAINT tickets_code_key             UNIQUE (code);
ALTER TABLE ONLY public.token_blacklist   ADD CONSTRAINT token_blacklist_pkey         PRIMARY KEY (token_hash);
ALTER TABLE ONLY public.users             ADD CONSTRAINT users_pkey                   PRIMARY KEY (id);
ALTER TABLE ONLY public.users             ADD CONSTRAINT users_email_key              UNIQUE (email);
ALTER TABLE ONLY public.vendor_stats      ADD CONSTRAINT vendor_stats_pkey            PRIMARY KEY (vendor_id);
ALTER TABLE ONLY public.vendor_trust_score ADD CONSTRAINT vendor_trust_score_pkey     PRIMARY KEY (vendor_id);
ALTER TABLE ONLY public.vendors           ADD CONSTRAINT vendors_pkey                 PRIMARY KEY (id);
ALTER TABLE ONLY public.vendors           ADD CONSTRAINT vendors_owner_id_key         UNIQUE (owner_id);
ALTER TABLE ONLY public.vendors           ADD CONSTRAINT vendors_owner_id_unique      UNIQUE (owner_id);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_email_outbox_status                ON public.email_outbox      USING btree (status) WHERE (status = 'pending'::text);
CREATE INDEX idx_events_active_discovery            ON public.events            USING btree (start_date) WHERE (is_deleted = false);
CREATE INDEX idx_events_category                    ON public.events            USING btree (category);
CREATE INDEX idx_events_date                        ON public.events            USING btree (start_date);
CREATE INDEX idx_events_deleted_at                  ON public.events            USING btree (deleted_at) WHERE (is_deleted = true);
CREATE INDEX idx_events_location                    ON public.events            USING btree (state, city);
CREATE INDEX idx_events_organizer                   ON public.events            USING btree (organizer_id);
CREATE UNIQUE INDEX idx_events_slug                 ON public.events            USING btree (event_slug) WHERE (event_slug IS NOT NULL);
CREATE INDEX idx_events_slug_active                 ON public.events            USING btree (event_slug) WHERE (is_deleted = false);
CREATE INDEX idx_events_start_date                  ON public.events            USING btree (start_date) WHERE (is_deleted = false);
CREATE INDEX idx_events_status_date                 ON public.events            USING btree (is_deleted, start_date) WHERE (is_deleted = false);
CREATE INDEX idx_events_tags_gin                    ON public.events            USING gin (tags);
CREATE INDEX idx_feedback_created_at                ON public.feedback          USING btree (created_at);
CREATE INDEX idx_feedback_guest_id                  ON public.feedback          USING btree (guest_id);
CREATE INDEX idx_feedback_type                      ON public.feedback          USING btree (type);
CREATE INDEX idx_feedback_user_id                   ON public.feedback          USING btree (user_id);
CREATE INDEX idx_inquiries_guest_id                 ON public.inquiries         USING btree (guest_id);
CREATE INDEX idx_inquiries_trust_signal             ON public.inquiries         USING btree (vendor_id, user_id, ip_address);
CREATE INDEX idx_inquiries_user_id                  ON public.inquiries         USING btree (user_id);
CREATE INDEX idx_inquiries_vendor_created           ON public.inquiries         USING btree (vendor_id, created_at DESC);
CREATE INDEX idx_inquiries_vendor_id                ON public.inquiries         USING btree (vendor_id);
CREATE INDEX idx_login_attempts_last_attempt        ON public.login_attempts    USING btree (last_attempt_at);
CREATE INDEX idx_order_items_event_id               ON public.order_items       USING btree (event_id);
CREATE INDEX idx_order_items_order_id               ON public.order_items       USING btree (order_id);
CREATE INDEX idx_order_items_ticket_tier_id         ON public.order_items       USING btree (ticket_tier_id);
CREATE INDEX idx_orders_event_status_date           ON public.orders            USING btree (status, created_at);
CREATE INDEX idx_orders_guest_id                    ON public.orders            USING btree (guest_id);
CREATE UNIQUE INDEX idx_orders_reference            ON public.orders            USING btree (reference);
CREATE INDEX idx_orders_status                      ON public.orders            USING btree (status);
CREATE INDEX idx_orders_user_id                     ON public.orders            USING btree (user_id);
CREATE UNIQUE INDEX idx_payments_gateway_reference  ON public.payments          USING btree (gateway_reference);
CREATE INDEX idx_payments_order_id                  ON public.payments          USING btree (order_id);
CREATE INDEX idx_payments_status                    ON public.payments          USING btree (status);
CREATE INDEX idx_profile_views_dedupe               ON public.profile_views     USING btree (vendor_id, session_id, viewer_ip, viewed_at DESC);
CREATE INDEX idx_profile_views_ip_vendor_time       ON public.profile_views     USING btree (viewer_ip, vendor_id, viewed_at DESC);
CREATE INDEX idx_profile_views_session_vendor       ON public.profile_views     USING btree (session_id, vendor_id);
CREATE INDEX idx_profile_views_user_vendor          ON public.profile_views     USING btree (viewer_id, vendor_id, viewed_at DESC) WHERE (viewer_id IS NOT NULL);
CREATE INDEX idx_profile_views_vendor               ON public.profile_views     USING btree (vendor_id);
CREATE INDEX idx_profile_views_vendor_date          ON public.profile_views     USING btree (vendor_id, date(viewed_at));
CREATE INDEX idx_profile_views_viewed_at            ON public.profile_views     USING btree (viewed_at DESC);
CREATE INDEX idx_reviews_email                      ON public.reviews           USING btree (email);
CREATE INDEX idx_reviews_email_lower                ON public.reviews           USING btree (lower((email)::text));
CREATE UNIQUE INDEX idx_reviews_one_per_user_vendor ON public.reviews           USING btree (vendor_id, COALESCE((user_id)::text, (ip_address)::text));
CREATE INDEX idx_reviews_trust_check                ON public.reviews           USING btree (email, vendor_id);
CREATE INDEX idx_reviews_vendor_created             ON public.reviews           USING btree (vendor_id, created_at DESC);
CREATE INDEX idx_reviews_vendor_id                  ON public.reviews           USING btree (vendor_id);
CREATE INDEX idx_reviews_vendor_rating              ON public.reviews           USING btree (vendor_id, rating);
CREATE INDEX idx_reviews_vendor_trust               ON public.reviews           USING btree (vendor_id, trust_weight);
CREATE INDEX idx_stats_cat_lookup                   ON public.vendor_stats      USING btree (category_rank) WHERE (category_rank > 0);
CREATE INDEX idx_stats_composite_score              ON public.vendor_stats      USING btree (composite_score DESC);
CREATE INDEX idx_subscriptions_1d_reminder          ON public.subscriptions     USING btree (expires_at, reminder_1d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_1d_sent_at IS NULL));
CREATE INDEX idx_subscriptions_3d_reminder          ON public.subscriptions     USING btree (expires_at, reminder_3d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_3d_sent_at IS NULL));
CREATE INDEX idx_subscriptions_7d_reminder          ON public.subscriptions     USING btree (expires_at, reminder_7d_sent_at) WHERE (((status)::text = 'active'::text) AND (auto_renew = true) AND (reminder_7d_sent_at IS NULL));
CREATE INDEX idx_subscriptions_expired_notice       ON public.subscriptions     USING btree (status, expired_notice_sent_at) WHERE (((status)::text = 'expired'::text) AND (expired_notice_sent_at IS NULL));
CREATE INDEX idx_subscriptions_expiry               ON public.subscriptions     USING btree (expires_at) WHERE (((status)::text = 'active'::text) AND (expires_at IS NOT NULL));
CREATE INDEX idx_subscriptions_expiry_reminders     ON public.subscriptions     USING btree (expires_at, status, auto_renew) WHERE ((status)::text = 'active'::text);
CREATE INDEX idx_subscriptions_payment_ref          ON public.subscriptions     USING btree (payment_reference) WHERE (payment_reference IS NOT NULL);
CREATE INDEX idx_subscriptions_status               ON public.subscriptions     USING btree (status);
CREATE INDEX idx_subscriptions_status_expiry        ON public.subscriptions     USING btree (status, expires_at) WHERE ((status)::text = 'active'::text);
CREATE INDEX idx_subscriptions_tier                 ON public.subscriptions     USING btree (tier);
CREATE UNIQUE INDEX idx_subscriptions_unique_active_vendor ON public.subscriptions USING btree (vendor_id) WHERE ((status)::text = 'active'::text);
CREATE INDEX idx_subscriptions_vendor_active        ON public.subscriptions     USING btree (vendor_id, status) WHERE ((status)::text = 'active'::text);
CREATE INDEX idx_subscriptions_vendor_id            ON public.subscriptions     USING btree (vendor_id);
CREATE INDEX idx_subscriptions_vendor_latest        ON public.subscriptions     USING btree (vendor_id, created_at DESC);
CREATE INDEX idx_ticket_tiers_event_id              ON public.ticket_tiers      USING btree (event_id);
CREATE INDEX idx_ticket_tiers_event_tier            ON public.ticket_tiers      USING btree (event_id, name);
CREATE UNIQUE INDEX idx_tickets_code                ON public.tickets           USING btree (code);
CREATE INDEX idx_tickets_event_id_status            ON public.tickets           USING btree (event_id, status);
CREATE INDEX idx_tickets_order_id                   ON public.tickets           USING btree (order_id);
CREATE INDEX idx_tickets_user_id                    ON public.tickets           USING btree (user_id);
CREATE INDEX idx_tiers_event_id                     ON public.ticket_tiers      USING btree (event_id);
CREATE INDEX idx_token_blacklist_expiry             ON public.token_blacklist   USING btree (expires_at);
CREATE INDEX idx_tokens_expires_at_revoked          ON public.refresh_tokens    USING btree (expires_at, revoked);
CREATE INDEX idx_tokens_user_id                     ON public.refresh_tokens    USING btree (user_id);
CREATE UNIQUE INDEX idx_unique_user_vendor_review   ON public.reviews           USING btree (vendor_id, user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX idx_users_email                 ON public.users             USING btree (email);
CREATE INDEX idx_users_reminder_prefs               ON public.users             USING btree (allow_reminder_emails) WHERE (allow_reminder_emails = true);
CREATE INDEX idx_users_reset_token                  ON public.users             USING btree (reset_token);
CREATE INDEX idx_vendors_category                   ON public.vendors           USING btree (category);
CREATE INDEX idx_vendors_category_state_status      ON public.vendors           USING btree (category, state, status);
CREATE INDEX idx_vendors_created                    ON public.vendors           USING btree (created_at DESC);
CREATE INDEX idx_vendors_deleted_at                 ON public.vendors           USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX idx_vendors_id                         ON public.vendors           USING btree (id);
CREATE INDEX idx_vendors_leaderboard_lookup         ON public.vendors           USING btree (category, state, city) WHERE (status = 'active'::public.vendor_status);
CREATE INDEX idx_vendors_location                   ON public.vendors           USING btree (state, city);
CREATE INDEX idx_vendors_min_price                  ON public.vendors           USING btree (min_price);
CREATE INDEX idx_vendors_pvs_score                  ON public.vendors           USING btree (pvs_score DESC);
CREATE INDEX idx_vendors_status                     ON public.vendors           USING btree (status);
CREATE INDEX idx_vendors_subscription_tier          ON public.vendors           USING btree (subscription_tier);

-- ---------------------------------------------------------------------------
-- Views & materialized views
-- ---------------------------------------------------------------------------

CREATE VIEW public.v_subscriptions_needing_1d_reminder AS
    SELECT s.id AS subscription_id, s.vendor_id, s.tier, s.expires_at, s.price, s.currency,
           v.owner_id, v.name AS vendor_name, u.id AS user_id, u.email AS user_email,
           u.name AS user_name, u.allow_reminder_emails
    FROM ((public.subscriptions s
        JOIN public.vendors v ON ((s.vendor_id = v.id)))
        JOIN public.users u ON ((v.owner_id = u.id)))
    WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true)
        AND (s.reminder_1d_sent_at IS NULL)
        AND (s.expires_at <= (now() + '1 day'::interval)) AND (s.expires_at > now())
        AND (u.allow_reminder_emails = true));

CREATE VIEW public.v_subscriptions_needing_3d_reminder AS
    SELECT s.id AS subscription_id, s.vendor_id, s.tier, s.expires_at, s.price, s.currency,
           v.owner_id, v.name AS vendor_name, u.id AS user_id, u.email AS user_email,
           u.name AS user_name, u.allow_reminder_emails
    FROM ((public.subscriptions s
        JOIN public.vendors v ON ((s.vendor_id = v.id)))
        JOIN public.users u ON ((v.owner_id = u.id)))
    WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true)
        AND (s.reminder_3d_sent_at IS NULL)
        AND (s.expires_at <= (now() + '3 days'::interval))
        AND (s.expires_at > (now() + '2 days'::interval))
        AND (u.allow_reminder_emails = true));

CREATE VIEW public.v_subscriptions_needing_7d_reminder AS
    SELECT s.id AS subscription_id, s.vendor_id, s.tier, s.expires_at, s.price, s.currency,
           v.owner_id, v.name AS vendor_name, u.id AS user_id, u.email AS user_email,
           u.name AS user_name, u.allow_reminder_emails
    FROM ((public.subscriptions s
        JOIN public.vendors v ON ((s.vendor_id = v.id)))
        JOIN public.users u ON ((v.owner_id = u.id)))
    WHERE (((s.status)::text = 'active'::text) AND (s.auto_renew = true)
        AND (s.reminder_7d_sent_at IS NULL)
        AND (s.expires_at <= (now() + '7 days'::interval))
        AND (s.expires_at > (now() + '6 days'::interval))
        AND (u.allow_reminder_emails = true));

CREATE VIEW public.v_subscriptions_needing_expired_notice AS
    SELECT s.id AS subscription_id, s.vendor_id, s.tier, s.expires_at, s.price, s.currency,
           v.owner_id, v.name AS vendor_name, u.id AS user_id, u.email AS user_email, u.name AS user_name
    FROM ((public.subscriptions s
        JOIN public.vendors v ON ((s.vendor_id = v.id)))
        JOIN public.users u ON ((v.owner_id = u.id)))
    WHERE (((s.status)::text = 'expired'::text) AND (s.expired_notice_sent_at IS NULL));

CREATE MATERIALIZED VIEW public.vendor_daily_metrics AS
    SELECT v.id AS vendor_id, v.name, v.category,
        count(DISTINCT CASE WHEN (i.created_at >= (now() - '7 days'::interval))  THEN i.id ELSE NULL::uuid END) AS inquiries_7d,
        count(DISTINCT CASE WHEN (r.created_at >= (now() - '7 days'::interval))  THEN r.id ELSE NULL::uuid END) AS reviews_7d,
        COALESCE(avg(CASE WHEN (r.created_at >= (now() - '7 days'::interval))  THEN r.rating ELSE NULL::smallint END), 0) AS avg_rating_7d,
        count(DISTINCT CASE WHEN (i.created_at >= (now() - '30 days'::interval)) THEN i.id ELSE NULL::uuid END) AS inquiries_30d,
        count(DISTINCT CASE WHEN (r.created_at >= (now() - '30 days'::interval)) THEN r.id ELSE NULL::uuid END) AS reviews_30d,
        COALESCE(avg(CASE WHEN (r.created_at >= (now() - '30 days'::interval)) THEN r.rating ELSE NULL::smallint END), 0) AS avg_rating_30d,
        count(DISTINCT i.id) AS total_inquiries,
        count(DISTINCT r.id) AS total_reviews,
        COALESCE(avg(r.rating), 0) AS avg_rating_all,
        now() AS last_updated
    FROM ((public.vendors v
        LEFT JOIN public.inquiries i ON ((v.id = i.vendor_id)))
        LEFT JOIN public.reviews r   ON ((v.id = r.vendor_id)))
    GROUP BY v.id, v.name, v.category
    WITH NO DATA;

CREATE UNIQUE INDEX idx_vendor_daily_metrics_vendor_id ON public.vendor_daily_metrics USING btree (vendor_id);
CREATE INDEX idx_vendor_daily_metrics_category         ON public.vendor_daily_metrics USING btree (category);
CREATE INDEX idx_vendor_daily_metrics_updated          ON public.vendor_daily_metrics USING btree (last_updated DESC);

CREATE MATERIALIZED VIEW public.vendor_of_the_month AS
    WITH monthly_views AS (
        SELECT pv.vendor_id, count(*) AS view_count, date_trunc('month'::text, pv.viewed_at) AS month
        FROM public.profile_views pv
        WHERE (pv.viewed_at >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))
        GROUP BY pv.vendor_id, (date_trunc('month'::text, pv.viewed_at))
    )
    SELECT v.id AS vendor_id, v.name, v.category, v.state, v.city, v.subscription_tier,
        COALESCE(mv.view_count, 0) AS monthly_views, v.pvs_score, v.review_count,
        row_number() OVER (ORDER BY COALESCE(mv.view_count, 0) DESC, v.pvs_score DESC) AS overall_rank,
        row_number() OVER (PARTITION BY v.category ORDER BY COALESCE(mv.view_count, 0) DESC, v.pvs_score DESC) AS category_rank,
        row_number() OVER (PARTITION BY v.state, v.city ORDER BY COALESCE(mv.view_count, 0) DESC, v.pvs_score DESC) AS location_rank,
        now() AS last_updated
    FROM (public.vendors v LEFT JOIN monthly_views mv ON ((v.id = mv.vendor_id)))
    WHERE ((v.status = 'active'::public.vendor_status)
        AND ((v.subscription_tier)::text = ANY ((ARRAY['premium'::character varying, 'featured'::character varying])::text[])))
    WITH NO DATA;

CREATE UNIQUE INDEX idx_vendor_of_the_month_vendor_id ON public.vendor_of_the_month USING btree (vendor_id);
CREATE UNIQUE INDEX idx_vendor_month_id               ON public.vendor_of_the_month USING btree (vendor_id);
CREATE INDEX idx_vendor_month_category                ON public.vendor_of_the_month USING btree (category, category_rank);
CREATE INDEX idx_vendor_month_location                ON public.vendor_of_the_month USING btree (state, city, location_rank);
CREATE INDEX idx_vendor_month_overall                 ON public.vendor_of_the_month USING btree (overall_rank);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER events_updated_at        BEFORE UPDATE ON public.events        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER feedback_updated_at      BEFORE UPDATE ON public.feedback      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER inquiries_updated_at     BEFORE UPDATE ON public.inquiries     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER orders_updated_at        BEFORE UPDATE ON public.orders        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER reviews_updated_at       BEFORE UPDATE ON public.reviews       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ticket_tiers_updated_at  BEFORE UPDATE ON public.ticket_tiers  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tickets_updated_at       BEFORE UPDATE ON public.tickets       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER users_updated_at         BEFORE UPDATE ON public.users         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendors_updated_at       BEFORE UPDATE ON public.vendors       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_after_inquiry        AFTER INSERT OR DELETE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.trg_update_trust_score_on_inquiry_change();
CREATE TRIGGER trg_after_review         AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.trg_update_trust_score_on_review_change();
CREATE TRIGGER trg_lock_price_on_sales  BEFORE UPDATE ON public.ticket_tiers FOR EACH ROW EXECUTE FUNCTION public.protect_sold_ticket_prices();

CREATE TRIGGER trigger_cleanup_old_views          AFTER INSERT    ON public.profile_views  FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_profile_views();
CREATE TRIGGER trigger_sync_vendor_tier           AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_subscription_tier();
CREATE TRIGGER trigger_update_subscriptions_timestamp BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_subscriptions_updated_at();
CREATE TRIGGER trigger_validate_activation        BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_activation();

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY public.events         ADD CONSTRAINT events_organizer_id_fkey         FOREIGN KEY (organizer_id)   REFERENCES public.users(id)        ON DELETE RESTRICT;
ALTER TABLE ONLY public.feedback       ADD CONSTRAINT feedback_user_id_fkey             FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.inquiries      ADD CONSTRAINT inquiries_user_id_fkey            FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.inquiries      ADD CONSTRAINT inquiries_vendor_id_fkey          FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items    ADD CONSTRAINT fk_order_items_event              FOREIGN KEY (event_id)       REFERENCES public.events(id)       ON DELETE RESTRICT;
ALTER TABLE ONLY public.order_items    ADD CONSTRAINT order_items_event_id_fkey         FOREIGN KEY (event_id)       REFERENCES public.events(id)       ON DELETE RESTRICT;
ALTER TABLE ONLY public.order_items    ADD CONSTRAINT order_items_order_id_fkey         FOREIGN KEY (order_id)       REFERENCES public.orders(id)       ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items    ADD CONSTRAINT order_items_ticket_tier_id_fkey   FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.orders         ADD CONSTRAINT orders_user_id_fkey               FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.payments       ADD CONSTRAINT payments_order_id_fkey            FOREIGN KEY (order_id)       REFERENCES public.orders(id)       ON DELETE RESTRICT;
ALTER TABLE ONLY public.profile_views  ADD CONSTRAINT fk_vendor                         FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_parent_id_fkey     FOREIGN KEY (parent_id)      REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey       FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews        ADD CONSTRAINT fk_review_user                    FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.reviews        ADD CONSTRAINT fk_review_vendor                  FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews        ADD CONSTRAINT reviews_user_id_fkey              FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.reviews        ADD CONSTRAINT reviews_vendor_id_fkey            FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.subscriptions  ADD CONSTRAINT fk_vendor                         FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.ticket_tiers   ADD CONSTRAINT ticket_tiers_event_id_fkey        FOREIGN KEY (event_id)       REFERENCES public.events(id)       ON DELETE CASCADE;
ALTER TABLE ONLY public.tickets        ADD CONSTRAINT tickets_event_id_fkey             FOREIGN KEY (event_id)       REFERENCES public.events(id)       ON DELETE RESTRICT;
ALTER TABLE ONLY public.tickets        ADD CONSTRAINT tickets_order_id_fkey             FOREIGN KEY (order_id)       REFERENCES public.orders(id)       ON DELETE RESTRICT;
ALTER TABLE ONLY public.tickets        ADD CONSTRAINT tickets_ticket_tier_id_fkey       FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.tickets        ADD CONSTRAINT tickets_user_id_fkey              FOREIGN KEY (user_id)        REFERENCES public.users(id)        ON DELETE SET NULL;
ALTER TABLE ONLY public.vendor_stats   ADD CONSTRAINT vendor_stats_vendor_id_fkey       FOREIGN KEY (vendor_id)      REFERENCES public.vendors(id)      ON DELETE CASCADE;
ALTER TABLE ONLY public.vendor_trust_score ADD CONSTRAINT vendor_trust_score_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE ONLY public.vendors        ADD CONSTRAINT vendors_owner_id_fkey             FOREIGN KEY (owner_id)       REFERENCES public.users(id)        ON DELETE CASCADE;