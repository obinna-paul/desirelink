import Stripe from "stripe";

import type { PaymentProvider, WebhookEvent, WebhookPaymentMethod } from "./types";

function toWebhookPaymentMethod(method: Stripe.PaymentMethod | null | undefined): WebhookPaymentMethod | null {
  if (!method?.card) return null;
  return {
    id: method.id,
    brand: method.card.brand,
    last4: method.card.last4,
    expMonth: method.card.exp_month,
    expYear: method.card.exp_year,
    country: method.card.country ?? "",
  };
}

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCustomer(userId: string, email: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });
    return customer.id;
  }

  /** Uses Stripe's inline `price_data` rather than a pre-created Price object, since our tiers/plans price dynamically (CreatorTier.priceCents, the $5 Premium price) rather than through fixed catalog prices. */
  async createCheckoutSession(
    customerId: string,
    amountCents: number,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: { currency: "usd", unit_amount: amountCents, product_data: { name: "Udala" } },
          quantity: 1,
        },
      ],
      payment_intent_data: { setup_future_usage: "off_session" },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout session URL");
    }

    return session.url;
  }

  async chargeSavedPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    metadata: Record<string, string> = {}
  ): Promise<{ reference: string; success: boolean }> {
    const intent = await this.stripe.paymentIntents.create({
      customer: customerId,
      payment_method: paymentMethodId,
      amount: amountCents,
      currency: "usd",
      off_session: true,
      confirm: true,
      metadata,
    });

    return { reference: intent.id, success: intent.status === "succeeded" };
  }

  async detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    void customerId;
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async verifyTransaction(reference: string): Promise<WebhookEvent> {
    const intent = await this.stripe.paymentIntents.retrieve(reference, { expand: ["payment_method"] });
    const paymentMethod =
      typeof intent.payment_method === "string" ? null : (intent.payment_method ?? null);

    return {
      type: intent.status === "succeeded" ? "charge.succeeded" : "charge.failed",
      customerId: typeof intent.customer === "string" ? intent.customer : (intent.customer?.id ?? null),
      paymentMethod: toWebhookPaymentMethod(paymentMethod),
      amountCents: intent.amount,
      reference: intent.id,
      metadata: intent.metadata as Record<string, string>,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface-mandated; Stripe requires the raw request body here, not a parsed type.
  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
      return { type: "unknown", customerId: null, paymentMethod: null, amountCents: null, reference: null, metadata: {} };
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentMethod =
      typeof intent.payment_method === "string"
        ? await this.stripe.paymentMethods.retrieve(intent.payment_method)
        : intent.payment_method;

    return {
      type: event.type === "payment_intent.succeeded" ? "charge.succeeded" : "charge.failed",
      customerId: typeof intent.customer === "string" ? intent.customer : (intent.customer?.id ?? null),
      paymentMethod: toWebhookPaymentMethod(paymentMethod),
      amountCents: intent.amount,
      reference: intent.id,
      metadata: intent.metadata as Record<string, string>,
    };
  }
}
