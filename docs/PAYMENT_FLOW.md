# QuickPrint Payment Integration & Verification Lifecycle

## 1. End-to-End Payment Sequence

```
[Customer Browser]                 [QuickPrint Server]               [Razorpay Gateway]
        │                                  │                                  │
        ├─ 1. POST /orders ───────────────►│                                  │
        │                                  ├─ 2. Calculate Final Paise        │
        │                                  │     Create Provider Order ──────►│
        │                                  │◄──── Order ID Returned ──────────┤
        │◄─ 3. Payment Order Initialized ──┤                                  │
        │                                                                     │
        ├─ 4. Customer Completes UPI/Card Checkout ──────────────────────────►│
        │                                                                     ├─ 5. Sign Webhook (HMAC-SHA256)
        │                                  │◄── 6. POST /webhooks ────────────┤
        │                                  │       (x-razorpay-signature)
        │                                  ├─ 7. Verify Signature vs Raw Body
        │                                  ├─ 8. Enforce Unique Event ID
        │                                  ├─ 9. Mark Order VERIFIED
        │                                  ├─ 10. Atomically Dispatch Job
        │                                  │
        ├─ 11. Poll GET /orders/:public_id ┼─ Status: QUEUED / PRINTING
```

## 2. Idempotency & Security Invariants

1. **Raw Body Hashing**: Webhooks must be computed using `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`. Parsed JSON objects with altered whitespace or key order will cause signature mismatches.
2. **Provider Payment ID De-duplication**: The database records `provider_payment_id` with a UNIQUE constraint.
3. **Single Initial Job Authorization**: Exactly one print job is created per verified order.
4. **Reconciliation**: If a network hiccup interrupts the webhook, the server reconciles pending orders on a scheduled cron task by querying the payment gateway API directly.
