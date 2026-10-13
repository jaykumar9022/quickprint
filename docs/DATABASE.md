# QuickPrint Database Design & Data Dictionary

The QuickPrint schema is normalized for high write throughput, transactional consistency, and idempotent payment handling.

## Schema Overview

### 1. `shop_settings`
- `id` (UUID / TEXT, PK)
- `name` (TEXT NOT NULL)
- `tagline` (TEXT)
- `address` (TEXT)
- `phone` (VARCHAR(20))
- `email` (VARCHAR(100))
- `upi_vpa` (VARCHAR(100))
- `currency` (VARCHAR(5) DEFAULT 'INR')
- `min_order_paise` (INTEGER DEFAULT 500)
- `max_file_size_mb` (INTEGER DEFAULT 25)
- `max_pages_allowed` (INTEGER DEFAULT 250)
- `retention_hours` (INTEGER DEFAULT 2)
- `webhook_secret` (TEXT NOT NULL)
- `agent_registration_key` (TEXT NOT NULL)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### 2. `documents`
- `id` (VARCHAR(64), PK)
- `original_filename` (TEXT NOT NULL)
- `storage_key` (TEXT NOT NULL UNIQUE)
- `file_path` (TEXT NOT NULL)
- `file_size_bytes` (BIGINT NOT NULL)
- `page_count` (INTEGER NOT NULL)
- `is_password_protected` (BOOLEAN DEFAULT FALSE)
- `is_valid_pdf` (BOOLEAN DEFAULT TRUE)
- `uploaded_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())
- `expires_at` (TIMESTAMP WITH TIME ZONE NOT NULL)

### 3. `orders`
- `id` (VARCHAR(64), PK)
- `public_id` (VARCHAR(32) NOT NULL UNIQUE) -- e.g. "QP-739182"
- `customer_phone` (VARCHAR(20))
- `customer_note` (TEXT)
- `document_id` (VARCHAR(64) REFERENCES documents(id))
- `total_paise` (BIGINT NOT NULL)
- `currency` (VARCHAR(5) DEFAULT 'INR')
- `payment_status` (VARCHAR(20) NOT NULL) -- PENDING, VERIFIED, FAILED, REFUNDED
- `print_status` (VARCHAR(30) NOT NULL) -- AWAITING_PAYMENT, QUEUED, CLAIMED, DOWNLOADING, SUBMITTED_TO_SPOOLER, COMPLETED, FAILED, CANCELLED, NEEDS_OPERATOR_REVIEW
- `payment_id` (VARCHAR(100))
- `provider_order_id` (VARCHAR(100))
- `print_job_id` (VARCHAR(64))
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())
- `updated_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())

### 4. `order_items`
- `id` (VARCHAR(64), PK)
- `order_id` (VARCHAR(64) REFERENCES orders(id) ON DELETE CASCADE)
- `print_mode` (VARCHAR(10) NOT NULL) -- 'bw' or 'color'
- `paper_size` (VARCHAR(10) NOT NULL) -- 'A4', 'A3', 'Legal'
- `print_sides` (VARCHAR(10) NOT NULL) -- 'single' or 'double'
- `copies` (INTEGER NOT NULL DEFAULT 1)
- `page_selection` (VARCHAR(10) NOT NULL) -- 'all' or 'custom'
- `custom_pages` (TEXT)
- `calculated_pages` (INTEGER NOT NULL)
- `sheets_used` (INTEGER NOT NULL)
- `subtotal_paise` (BIGINT NOT NULL)

### 5. `payments`
- `id` (VARCHAR(64), PK)
- `order_id` (VARCHAR(64) REFERENCES orders(id))
- `provider` (VARCHAR(30) DEFAULT 'RAZORPAY_SANDBOX')
- `provider_order_id` (VARCHAR(100) NOT NULL)
- `provider_payment_id` (VARCHAR(100) UNIQUE)
- `amount_paise` (BIGINT NOT NULL)
- `currency` (VARCHAR(5) DEFAULT 'INR')
- `status` (VARCHAR(20) NOT NULL)
- `method` (VARCHAR(30))
- `verified_at` (TIMESTAMP WITH TIME ZONE)
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())

### 6. `print_jobs`
- `id` (VARCHAR(64), PK)
- `order_id` (VARCHAR(64) REFERENCES orders(id) UNIQUE) -- 1:1 mapping ensures exactly one initial job per order
- `public_id` (VARCHAR(32) NOT NULL)
- `agent_id` (VARCHAR(64))
- `printer_name` (TEXT NOT NULL)
- `status` (VARCHAR(30) NOT NULL)
- `spooler_job_id` (TEXT)
- `total_pages` (INTEGER NOT NULL)
- `copies` (INTEGER NOT NULL)
- `retry_count` (INTEGER DEFAULT 0)
- `claimed_at` (TIMESTAMP WITH TIME ZONE)
- `completed_at` (TIMESTAMP WITH TIME ZONE)
- `failed_reason` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())
- `updated_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())

### 7. `print_events`
- `id` (VARCHAR(64), PK)
- `job_id` (VARCHAR(64) REFERENCES print_jobs(id))
- `state` (VARCHAR(30) NOT NULL)
- `message` (TEXT NOT NULL)
- `timestamp` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())

### 8. `audit_logs`
- `id` (VARCHAR(64), PK)
- `actor` (VARCHAR(50) NOT NULL)
- `action` (VARCHAR(50) NOT NULL)
- `target` (TEXT NOT NULL)
- `details` (TEXT)
- `timestamp` (TIMESTAMP WITH TIME ZONE DEFAULT NOW())
