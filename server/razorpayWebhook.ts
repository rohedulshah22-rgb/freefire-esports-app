import express, { type Express, type Request, type Response } from "express";
import { markPaymentAttemptFailed, settleVerifiedPaymentAttempt } from "./db";
import { getRazorpayReadiness, verifyRazorpayWebhookSignature } from "./razorpay";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_description?: string;
      };
    };
  };
};

function rawBody(request: Request) {
  return Buffer.isBuffer(request.body) ? request.body.toString("utf8") : "";
}

export function registerRazorpayWebhook(app: Express) {
  app.post("/api/payments/razorpay/webhook", express.raw({ type: "application/json" }), async (request: Request, response: Response) => {
    const readiness = getRazorpayReadiness();
    if (!readiness.configured) {
      response.status(503).json({ error: "Razorpay is not configured" });
      return;
    }

    const body = rawBody(request);
    const signature = request.header("x-razorpay-signature") ?? "";
    if (!verifyRazorpayWebhookSignature(body, signature)) {
      response.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(body) as RazorpayWebhookPayload;
    } catch {
      response.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) {
      response.status(204).end();
      return;
    }

    try {
      if (payload.event === "payment.captured" || payload.event === "order.paid") {
        await settleVerifiedPaymentAttempt({
          providerOrderId: payment.order_id,
          providerPaymentId: payment.id,
          providerEventId: request.header("x-razorpay-event-id") ?? undefined,
        });
      } else if (payload.event === "payment.failed") {
        await markPaymentAttemptFailed(payment.order_id, payment.error_description ?? "Razorpay payment failed");
      }
      response.status(200).json({ received: true });
    } catch (error) {
      console.error("[Razorpay] Webhook processing failed", error);
      response.status(400).json({ error: error instanceof Error ? error.message : "Webhook processing failed" });
    }
  });
}
