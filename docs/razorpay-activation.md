# Razorpay Activation Guide

The application now contains a **provider-ready payment foundation** but deliberately remains in testing mode. It does not display a live QR code, initiate payment collection, or credit any wallet automatically until the merchant credentials below are supplied through secure project settings.

| Secret | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` | Identifies the merchant account to Razorpay Checkout. |
| `RAZORPAY_KEY_SECRET` | Server-only credential used to create Razorpay orders. |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies the signed raw webhook payload before settlement. |

After configuration, set the Razorpay Dashboard payment webhook URL to:

```text
https://freefireesports-x23zgzvt.manus.space/api/payments/razorpay/webhook
```

Subscribe to `payment.captured`, `order.paid`, and `payment.failed`. The server keeps the raw webhook body, verifies the Razorpay signature, locks the linked payment attempt, and credits the player’s **Deposit Balance** exactly once. Replayed capture events acknowledge successfully but do not add funds a second time.

> Do not activate checkout or distribute payment links until the merchant account is live, the credentials are stored securely, and the webhook has been tested in the provider’s test environment.
