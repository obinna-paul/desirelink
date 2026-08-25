import { NextResponse } from "next/server";

import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";

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

  try {
    const event = await paymentProvider.handleWebhook(rawBody, signature);
    await processPaymentEvent(event);
  } catch (error) {
    console.error("[webhooks/paystack] failed to process event", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
