import type { PaymentMethod, PaymentProvider, WebhookEvent, WebhookEventType } from "./types";

const SIMULATED_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeId(prefix: string): string {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 12)}`;
}

type MockSubscription = { customerId: string; priceId: string; status: "active" | "cancelled" };

/**
 * In-memory provider for local development and tests. Every call resolves
 * successfully after a 1s delay to mimic real network latency, and every ID
 * is fake — nothing here talks to a real payment network.
 */
export class MockPaymentProvider implements PaymentProvider {
  private customers = new Map<string, { userId: string; email: string }>();
  private subscriptions = new Map<string, MockSubscription>();
  private paymentMethods = new Map<string, PaymentMethod[]>();

  async createCustomer(userId: string, email: string): Promise<string> {
    await delay(SIMULATED_DELAY_MS);
    const customerId = fakeId("cus");
    this.customers.set(customerId, { userId, email });
    return customerId;
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    await delay(SIMULATED_DELAY_MS);
    void cancelUrl;
    const { subscriptionId } = await this.createSubscription(customerId, priceId);
    const separator = successUrl.includes("?") ? "&" : "?";
    return `${successUrl}${separator}mock_subscription_id=${subscriptionId}`;
  }

  async createSubscription(customerId: string, priceId: string): Promise<{ subscriptionId: string }> {
    await delay(SIMULATED_DELAY_MS);
    const subscriptionId = fakeId("sub");
    this.subscriptions.set(subscriptionId, { customerId, priceId, status: "active" });
    return { subscriptionId };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await delay(SIMULATED_DELAY_MS);
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) subscription.status = "cancelled";
  }

  async retryPayment(subscriptionId: string): Promise<void> {
    await delay(SIMULATED_DELAY_MS);
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) subscription.status = "active";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface-mandated; mirrors the real provider's raw-payload shape.
  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    void signature;
    const body = typeof payload === "string" || Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
    const type: WebhookEventType = body?.type ?? "unknown";
    const data = body?.data ?? {};

    return {
      type,
      subscriptionId: data.subscriptionId ?? null,
      customerId: data.customerId ?? null,
      invoiceId: data.invoiceId ?? null,
      attemptCount: data.attemptCount ?? null,
      metadata: data.metadata ?? {},
    };
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    await delay(SIMULATED_DELAY_MS);
    return this.paymentMethods.get(customerId) ?? [];
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await delay(SIMULATED_DELAY_MS);
    const methods = this.paymentMethods.get(customerId) ?? [];
    methods.push({
      id: paymentMethodId,
      brand: "visa",
      last4: "4242",
      country: "US",
      isDefault: methods.length === 0,
    });
    this.paymentMethods.set(customerId, methods);
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await delay(SIMULATED_DELAY_MS);
    const methods = this.paymentMethods.get(customerId) ?? [];
    for (const method of methods) {
      method.isDefault = method.id === paymentMethodId;
    }
  }
}
