import Stripe from "stripe";

import type { PaymentMethod, PaymentProvider, WebhookEvent, WebhookEventType } from "./types";

const KNOWN_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
];

function isKnownWebhookEventType(type: string): type is WebhookEventType {
  return (KNOWN_WEBHOOK_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Dunning policy for failed recurring payments. Stripe's own Smart Retries
 * (Dashboard > Billing > Subscriptions and emails) must be configured to
 * match this schedule — the API has no per-subscription "retry N times over
 * M days" parameter. webhook-handler.ts uses these constants, together with
 * the `attemptCount` Stripe reports on each `invoice.payment_failed` event,
 * to decide when a subscription has exhausted its retries.
 */
export const MAX_PAYMENT_RETRY_ATTEMPTS = 3;
export const PAYMENT_RETRY_WINDOW_DAYS = 7;

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

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout session URL");
    }

    return session.url;
  }

  /**
   * Creates a subscription for a customer with no active one, using Stripe
   * Billing directly (no Checkout redirect — the customer must already have
   * a default payment method attached). If the customer already has an
   * active subscription, this instead swaps its price on the existing
   * subscription with proration, which is how mid-cycle tier changes
   * (upgrade/downgrade) are supported.
   */
  async createSubscription(customerId: string, priceId: string): Promise<{ subscriptionId: string }> {
    const existing = await this.stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const currentSubscription = existing.data[0];
    if (currentSubscription) {
      const currentItem = currentSubscription.items.data[0];
      const updated = await this.stripe.subscriptions.update(currentSubscription.id, {
        items: currentItem ? [{ id: currentItem.id, price: priceId }] : [{ price: priceId }],
        proration_behavior: "create_prorations",
      });
      return { subscriptionId: updated.id };
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      proration_behavior: "create_prorations",
      expand: ["latest_invoice.payment_intent"],
    });

    return { subscriptionId: subscription.id };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /** Pays the subscription's latest open invoice now — a manual, on-demand retry (e.g. after the customer updates their card). */
  async retryPayment(subscriptionId: string): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });

    const invoice = subscription.latest_invoice;
    const invoiceId = typeof invoice === "string" ? invoice : invoice?.id;
    if (!invoiceId) return;

    await this.stripe.invoices.pay(invoiceId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface-mandated; Stripe requires the raw request body here, not a parsed type.
  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    const type = isKnownWebhookEventType(event.type) ? event.type : "unknown";
    const data = event.data.object as StripeEventObject;

    return {
      type,
      subscriptionId: extractSubscriptionId(data),
      customerId: extractCustomerId(data),
      invoiceId: data.object === "invoice" ? (data.id ?? null) : null,
      attemptCount: data.object === "invoice" ? (data.attempt_count ?? null) : null,
      metadata: (data.metadata as Record<string, string> | null) ?? {},
    };
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    const customer = await this.stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId =
      !customer.deleted && typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : null;

    const methods = await this.stripe.paymentMethods.list({ customer: customerId, type: "card" });

    return methods.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand ?? "unknown",
      last4: method.card?.last4 ?? "0000",
      country: method.card?.country ?? "",
      isDefault: method.id === defaultPaymentMethodId,
    }));
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }
}

type StripeEventObject = {
  object?: string;
  id?: string;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  attempt_count?: number;
  metadata?: Record<string, string> | null;
};

function extractSubscriptionId(data: StripeEventObject): string | null {
  if (typeof data.subscription === "string") return data.subscription;
  if (data.subscription?.id) return data.subscription.id;
  if (data.object === "subscription" && typeof data.id === "string") return data.id;
  return null;
}

function extractCustomerId(data: StripeEventObject): string | null {
  if (typeof data.customer === "string") return data.customer;
  if (data.customer?.id) return data.customer.id;
  return null;
}
