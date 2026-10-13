# QuickPrint — Product Requirements Document (PRD)

## 1. Problem Statement
Physical printing shops face constant bottlenecks:
- Customers queue up to email or WhatsApp files to shop owners, exposing personal numbers and creating messy chat threads.
- Shopkeepers spend manual time downloading files, opening software, configuring print options, calculating prices, and handling cash.
- High error rates: wrong orientation, missing duplex settings, or customer disputes over pricing.

## 2. Solution: QuickPrint
QuickPrint is a contactless, automated web-based print ordering and hardware spooling system:
1. Customer walks into the print shop and scans the desk QR code.
2. Progressive web app opens immediately in browser (no download, no account required).
3. Customer uploads PDF; pages and dimensions are validated server-side.
4. Customer chooses Black & White or Color, Single-sided or Double-sided, copies, paper size, and page range.
5. Server quotes the exact minor-unit price (paise).
6. Customer pays via UPI (Google Pay, PhonePe, Paytm) or Card.
7. Gateway sends signed webhook; server verifies signature and atomically queues the print job.
8. Background Windows Print Agent daemon on shop PC polls and claims the job over secure outbound HTTPS.
9. Agent submits PDF to local Windows Print Spooler with exact DEVMODE parameters.
10. Customer collects printed pages directly from printer output tray.

## 3. User Personas
- **Customer**: Mobile-first user needing fast, private, error-free printing without sharing personal contacts.
- **Shop Operator / Owner**: Manages printers, views real-time revenues, sets rate cards, and handles exceptions.
- **Print Agent Daemon**: Unattended Windows client managing physical Win32 spooler hardware.

## 4. Non-Functional Requirements
- **Latency**: End-to-end time from payment capture to printer spool initiation < 5 seconds.
- **Privacy**: Temporary PDF storage with strict automatic deletion after 2 hours.
- **Security**: Strict webhook HMAC-SHA256 verification and agent token authentication.
