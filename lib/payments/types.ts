export type WebhookEventType =
  | "checkout.session.completed"
  | "invoice.payment_succeeded"
  | "invoice.payment_failed"
  | "customer.subscription.deleted"
  | "customer.subscription.updated"
  | "unknown";

export type WebhookEvent = {
  type: WebhookEventType;
  subscriptionId: string | null;
  customerId: string | null;
  invoiceId: string | null;
  /** Stripe's own count of payment attempts for this invoice (1 on first failure). Null for non-invoice events. */
  attemptCount: number | null;
  metadata: Record<string, string>;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  country: string;
  isDefault: boolean;
};

export interface PaymentProvider {
  createCustomer(userId: string, email: string): Promise<string>;

  createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string>;

  createSubscription(customerId: string, priceId: string): Promise<{ subscriptionId: string }>;

  cancelSubscription(subscriptionId: string): Promise<void>;

  retryPayment(subscriptionId: string): Promise<void>;

  /** `payload` must be the raw request body (string or Buffer), not parsed JSON — required for signature verification. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider-specific raw payload shape (Stripe: string | Buffer).
  handleWebhook(payload: any, signature: string): Promise<WebhookEvent>;

  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
}
