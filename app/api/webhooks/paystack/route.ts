import { NextResponse } from "next/server";

import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import type { WebhookEvent } from "@/lib/payments/types";

/**
 * Defense-in-depth alongside the synchronous redirect-verify path
 * (confirmProviderPayment / subscribeToPremium's checkout flow) — Paystack
 * recommends both: verify on redirect for immediate UX, and keep the webhook
 * as the source of truth in case the customer never makes it back.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: WebhookEvent;
  try {
    event = await paymentProvider.handleWebhook(rawBody, signature);
  } catch (error) {
    // Bad signature or malformed payload — Paystack won't get a different
    // result by retrying an unsigned/unparseable request, so 400 (no retry).
    console.error("[webhooks/paystack] rejected event", error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }

  try {
    await processPaymentEvent(event);
  } catch (error) {
    // The event was genuinely Paystack's, but something on our side (e.g. the
    // database) failed to record it — tell Paystack to retry rather than
    // silently dropping a real payment event.
    console.error("[webhooks/paystack] failed to process event", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
