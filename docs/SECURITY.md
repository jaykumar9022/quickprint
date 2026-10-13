# QuickPrint Security & Privacy Architecture

## 1. Document Privacy & Retention
- Customer uploaded documents are never retained permanently.
- Default retention TTL is set to 2 hours.
- A periodic server cleanup job deletes physical files from disk and removes document records.
- Document download endpoints are authenticated with short-lived or agent-restricted tokens.
- No public indexing or directory browsing is permitted.

## 2. Inbound Security (Shop Protection)
- Shop printers are completely private on the local LAN.
- The Print Agent initiates only outbound HTTPS connections to port 443 of the cloud server.
- No router port-forwarding, VPN, or public printer exposure is required.

## 3. Webhook Authentication
- Webhooks from Razorpay or UPI aggregators are verified using HMAC-SHA256 signatures over the raw request payload buffer.
- Requests with invalid signatures are rejected immediately.
- Duplicate event IDs are dropped idempotently.

## 4. Operator Role-Based Access Control
- Admin routes require strict `x-admin-token` verification.
- Passwords are encrypted and audited.
- Critical actions (price changes, refunds, manual job re-triggers) generate unalterable audit log entries.
