import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

export function getRazorpayReadiness() {
  const configured = Boolean(ENV.razorpayKeyId && ENV.razorpayKeySecret && ENV.razorpayWebhookSecret);
  return {
    provider: "razorpay" as const,
    mode: configured ? "ready_for_live_activation" as const : "testing" as const,
    configured,
    missingConfiguration: configured
      ? []
      : [
          ...(!ENV.razorpayKeyId ? ["RAZORPAY_KEY_ID"] : []),
          ...(!ENV.razorpayKeySecret ? ["RAZORPAY_KEY_SECRET"] : []),
          ...(!ENV.razorpayWebhookSecret ? ["RAZORPAY_WEBHOOK_SECRET"] : []),
        ],
  };
}

/** Uses the unmodified request body, as required for provider webhook signing. */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, webhookSecret = ENV.razorpayWebhookSecret) {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
};

export async function createRazorpayOrder(input: { amount: number; receipt: string; userId: number }) {
  const readiness = getRazorpayReadiness();
  if (!readiness.configured) throw new Error("Razorpay is not configured; the Deposit page remains in testing mode");
  const amountInPaise = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 5000) {
    throw new Error("Minimum deposit is 50 Coins");
  }

  const authorization = Buffer.from(`${ENV.razorpayKeyId}:${ENV.razorpayKeySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: { user_id: String(input.userId), payment_attempt_key: input.receipt },
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Razorpay order creation failed: ${response.status} ${details.slice(0, 160)}`);
  }
  return await response.json() as RazorpayOrderResponse;
}
