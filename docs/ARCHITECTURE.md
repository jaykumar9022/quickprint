# QuickPrint Architecture Specification

## 1. High-Level System Architecture

QuickPrint connects three distinct execution environments:
1. **Customer Mobile Device / Web Browser** (Zero-install progressive web application accessed via QR scan)
2. **Central Cloud Backend** (Multi-tenant ready, single-shop deployment in v1; Express/Flask REST API with atomic state machines)
3. **Local Shop Windows Print Station** (Secure background daemon running on the physical PC connected to USB/LAN printers)

```
[Customer Mobile Phone]
       │
       ▼ (Scan QR / Upload PDF)
[QuickPrint Cloud API] ◄──── (Webhook / Signature Verification) ──── [Razorpay Gateway]
       │
       │ (Encrypted HTTPS Outbound Polling / Heartbeats)
       ▼
[Windows Print Agent] ──── (Win32 Spooler API / DEVMODE) ────► [Physical Laser/Inkjet Printers]
```

## 2. Key Architectural Guarantees

1. **Zero Customer Footprint**: No apps to download. Responsive web flow optimized for 4G/5G mobile browsers.
2. **True Outbound Security**: Shop printers are never exposed to public internet. The print agent initiates all connections over TLS.
3. **Payment Idempotency**:
   - Webhook signatures are validated using HMAC-SHA256 against raw request payload.
   - Every provider payment ID is recorded with unique constraints.
   - Repeated webhook deliveries never generate duplicate print jobs.
4. **Reliable Spooling State Machine**:
   - `QUEUED`: Verified payment, waiting for agent to pull.
   - `CLAIMED`: Atomic lock acquired by registered agent.
   - `DOWNLOADING`: Streamed to local spool directory.
   - `SUBMITTED_TO_SPOOLER`: Handed to Windows spooler with DEVMODE parameters.
   - `COMPLETED`: Verified queue handover.
   - `NEEDS_OPERATOR_REVIEW` / `FAILED`: Isolated for operator retry or refund.
5. **Data Privacy**: Automatic TTL cleanup purges files from storage within shop retention window (default 2 hours).
