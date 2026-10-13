# QuickPrint REST API Documentation (v1)

Base URL: `/api/v1`

## 1. Public & Customer Endpoints

### `GET /health`
Returns system status, active agent connection, and queue depth.

### `GET /shop`
Returns public shop information, configured currency, and available hardware printers.

### `GET /pricing`
Returns current shop rate card (B&W per side, Color per side, paper multipliers, minimum order).

### `POST /documents`
Uploads a PDF document.
- Multipart form: `document: File`
- Response: `{ document: { id, originalFilename, fileSizeBytes, pageCount, uploadedAt, expiresAt } }`

### `GET /documents/:id/preview`
Streams document PDF inline for in-browser verification.

### `POST /quotes`
Calculates server-side pricing quote.
- Request Body: `{ documentId: string, config: PrintConfig }`
- Response: `{ quote: PriceQuote }`

### `POST /orders`
Creates pending order and reserves quote.
- Request Body: `{ documentId, config, customerPhone?, customerNote? }`
- Response: `{ order: OrderRecord }`

### `GET /orders/:public_id`
Retrieves live order state, assigned print job, and spooler event history.

### `POST /orders/:id/payments`
Initializes Razorpay-style payment order.

### `POST /webhooks/payment-provider`
Receives provider webhooks with `x-razorpay-signature` verification.

### `POST /orders/:id/simulate-payment`
Simulates sandbox checkout with internal signed webhook generation.

---

## 2. Print Agent Endpoints

All endpoints require header: `X-Agent-Key: <token>`

### `POST /agent/register`
Initializes a new shop workstation.
- Body: `{ registrationKey, machineHostname, name, printers }`

### `POST /agent/heartbeat`
Keep-alive signal and synchronizes local printer status.

### `POST /agent/jobs/claim`
Atomically claims next eligible paid print job in queue.

### `GET /agent/jobs/:id/document`
Downloads high-resolution PDF for claimed job.

### `POST /agent/jobs/:id/events`
Reports intermediate spooler transitions (`DOWNLOADING`, `SUBMITTED_TO_SPOOLER`).

### `POST /agent/jobs/:id/complete`
Confirms job handed over to spooler.

### `POST /agent/jobs/:id/fail`
Reports hardware errors (`FAILED`, `NEEDS_OPERATOR_REVIEW`).

---

## 3. Admin Endpoints

All endpoints require header: `x-admin-token: <session_token>`

### `POST /admin/auth/login`
Authenticates store operator (`admin` / `quickprint2026`).

### `GET /admin/dashboard`
Returns live metrics, revenue, and queue counts.

### `GET /admin/orders`
Filterable order list with pagination.

### `POST /admin/orders/:id/retry-print`
Operator-approved safe retry for interrupted print job.

### `POST /admin/orders/:id/cancel`
Cancels pending job.

### `POST /admin/orders/:id/refund`
Processes or records customer refund.

### `GET /admin/pricing` & `PATCH /admin/pricing`
Views and updates store rate card.

### `POST /admin/printers/test-print`
Sends hardware alignment test page to selected printer.
