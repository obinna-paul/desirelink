export type WebhookEventType =
  | "charge.succeeded"
  | "charge.failed"
  | "transfer.succeeded"
  | "transfer.failed"
  | "unknown";

export type WebhookPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  country: string;
};

export type WebhookEvent = {
  type: WebhookEventType;
  customerId: string | null;
  /** The saved card the charge ran against, or that got saved by it. Present whenever the provider returns one, on success or failure alike. */
  paymentMethod: WebhookPaymentMethod | null;
  amountCents: number | null;
  /** Provider-side transaction/charge id — our idempotency key for this event. */
  reference: string | null;
  metadata: Record<string, string>;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  country: string;
};

export type PayoutRecipientInput = {
  name: string;
  recipientType?: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  country?: string;
};

export type PayoutRecipient = {
  provider: "paystack" | "mock";
  recipientCode: string;
  status: "verified" | "pending" | "failed";
  bankName: string;
  accountLast4: string;
  accountName: string;
  country: string;
  currency: string;
};

export type PayoutTransferResult = {
  reference: string;
  status: "success" | "pending" | "failed";
};

/**
 * A payment provider's job, as this app uses it, has no need for
 * provider-side subscription objects: ProviderSubscription in our own
 * database is the single source of truth for subscription lifecycle
 * (status, endsAt, retries). All a provider has to do is move money and
 * hand back a saved card to bill again later.
 */
export interface PaymentProvider {
  createCustomer(userId: string, email: string): Promise<string>;

  /**
   * Starts a hosted, redirect-based checkout for a first-time charge — used
   * whenever the customer has no saved card yet. `metadata` is round-tripped
   * back on the webhook event so the handler can tell which of our rows
   * this payment is for.
   */
  createCheckoutSession(
    customerId: string,
    amountCents: number,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<string>;

  /** Off-session charge against an already-saved card — used for both "subscribe with an existing card" and recurring/retry billing. */
  chargeSavedPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    metadata?: Record<string, string>
  ): Promise<{ reference: string; success: boolean }>;

  /** Detaches/deactivates a saved card so it can no longer be charged. */
  detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  /** Creates or refreshes a provider payout recipient. Paystack stores the actual bank details. */
  createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipient>;

  /** Reads a normalized payout recipient status from the payment provider. */
  getPayoutRecipient(recipientCode: string): Promise<PayoutRecipient>;

  /** Sends money from the platform balance to a provider payout recipient. */
  createPayoutTransfer(
    recipientCode: string,
    amountCents: number,
    reason: string,
    metadata?: Record<string, string>
  ): Promise<PayoutTransferResult>;

  /**
   * Looks up a completed checkout transaction directly by reference —
   * Paystack's recommended pattern for confirming payment the moment the
   * customer redirects back, without waiting on webhook delivery. Returns
   * the same normalized shape as handleWebhook so both paths share one
   * processing function (see lib/payments/webhook-handler.ts).
   */
  verifyTransaction(reference: string): Promise<WebhookEvent>;

  /** `payload` must be the raw request body (string or Buffer), not parsed JSON — required for signature verification. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider-specific raw payload shape.
  handleWebhook(payload: any, signature: string): Promise<WebhookEvent>;
}
