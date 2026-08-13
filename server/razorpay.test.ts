import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhookSignature } from "./razorpay";

describe("Razorpay signature verification", () => {
  it("accepts only a signature generated from the exact raw webhook payload", () => {
    const rawBody = '{"event":"payment.captured"}';
    const secret = "test-webhook-secret";
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(verifyRazorpayWebhookSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(`${rawBody} `, signature, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(rawBody, "invalid", secret)).toBe(false);
  });
});
