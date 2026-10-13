-- =========================================================
-- QuickPrint Database Migration (PostgreSQL DDL)
-- Production Schema with Foreign Keys, Indexes & Constraints
-- =========================================================

-- 1. Shop Settings Table
CREATE TABLE IF NOT EXISTS shop_settings (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tagline TEXT,
    address TEXT,
    phone VARCHAR(32),
    email VARCHAR(128),
    upi_vpa VARCHAR(128),
    currency VARCHAR(8) DEFAULT 'INR',
    min_order_paise INTEGER DEFAULT 500,
    max_file_size_mb INTEGER DEFAULT 25,
    max_pages_allowed INTEGER DEFAULT 250,
    retention_hours INTEGER DEFAULT 2,
    webhook_secret VARCHAR(255) NOT NULL,
    agent_registration_key VARCHAR(255) NOT NULL,
    wifi_ssid VARCHAR(128),
    wifi_password VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pricing Rules Table
CREATE TABLE IF NOT EXISTS pricing_rules (
    id VARCHAR(64) PRIMARY KEY,
    shop_id VARCHAR(64) REFERENCES shop_settings(id) ON DELETE CASCADE,
    bw_price_paise INTEGER NOT NULL DEFAULT 200,
    color_price_paise INTEGER NOT NULL DEFAULT 1000,
    duplex_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 0.90,
    paper_size_rates_json JSONB NOT NULL DEFAULT '{"A4": 0, "Legal": 100, "A3": 600}',
    paper_type_rates_json JSONB NOT NULL DEFAULT '{"Normal (75gsm)": 0, "Bond (100gsm)": 300, "Glossy Photo (180gsm)": 1500}',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Documents Table (PDF metadata & TTL tracking)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    page_count INTEGER NOT NULL CHECK (page_count > 0),
    is_password_protected BOOLEAN DEFAULT FALSE,
    is_valid_pdf BOOLEAN DEFAULT TRUE,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    public_id VARCHAR(32) NOT NULL UNIQUE,
    customer_phone VARCHAR(32),
    customer_note TEXT,
    document_id VARCHAR(64) REFERENCES documents(id) ON DELETE SET NULL,
    document_name VARCHAR(255) NOT NULL,
    total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
    currency VARCHAR(8) DEFAULT 'INR',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    print_status VARCHAR(48) NOT NULL DEFAULT 'AWAITING_PAYMENT',
    payment_id VARCHAR(128),
    provider_order_id VARCHAR(128),
    print_job_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_public_id ON orders(public_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_order_id ON orders(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_print_status ON orders(print_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    document_id VARCHAR(64),
    print_mode VARCHAR(16) NOT NULL, -- 'bw' | 'color'
    paper_size VARCHAR(16) NOT NULL, -- 'A4' | 'Legal' | 'A3'
    print_sides VARCHAR(16) NOT NULL, -- 'single' | 'double'
    copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
    page_selection VARCHAR(16) NOT NULL, -- 'all' | 'custom'
    custom_pages TEXT,
    orientation VARCHAR(16) DEFAULT 'portrait',
    paper_type VARCHAR(64) DEFAULT 'Normal (75gsm)',
    calculated_pages INTEGER NOT NULL,
    sheets_used INTEGER NOT NULL,
    subtotal_paise INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(64) DEFAULT 'RAZORPAY_SANDBOX',
    provider_order_id VARCHAR(128) NOT NULL,
    provider_payment_id VARCHAR(128) UNIQUE,
    amount_paise INTEGER NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    method VARCHAR(32),
    signature TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);

-- 7. Webhook Events Table (Signed Webhook Deduplication & Audit)
CREATE TABLE IF NOT EXISTS webhook_events (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    order_id VARCHAR(64),
    payment_id VARCHAR(128),
    payload JSONB NOT NULL,
    is_valid_signature BOOLEAN NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at DESC);

-- 8. Print Agents Table (Windows Station Registrations)
CREATE TABLE IF NOT EXISTS print_agents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    machine_hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    api_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
    last_heartbeat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    version VARCHAR(64) DEFAULT 'QuickPrint-Agent-v1.4.2',
    printers_json JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_print_agents_api_key ON print_agents(api_key);

-- 9. Print Jobs Table
CREATE TABLE IF NOT EXISTS print_jobs (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    public_id VARCHAR(32) NOT NULL,
    agent_id VARCHAR(64) REFERENCES print_agents(id) ON DELETE SET NULL,
    printer_name VARCHAR(255) NOT NULL,
    status VARCHAR(48) NOT NULL DEFAULT 'QUEUED',
    spooler_job_id VARCHAR(128),
    config_json JSONB NOT NULL,
    document_id VARCHAR(64),
    total_pages INTEGER NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_agent_id ON print_jobs(agent_id);

-- 10. Print Events Table (Timeline Transitions)
CREATE TABLE IF NOT EXISTS print_events (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    state VARCHAR(48) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_print_events_job_id ON print_events(job_id);
CREATE INDEX IF NOT EXISTS idx_print_events_timestamp ON print_events(timestamp ASC);

-- 11. Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount_paise INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);

-- 12. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
