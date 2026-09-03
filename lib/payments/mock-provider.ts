import type {
  Bank,
  PaymentProvider,
  PayoutRecipient,
  PayoutRecipientInput,
  PayoutTransferResult,
  RefundResult,
  WebhookEvent,
  WebhookPaymentMethod,
} from "./types";

const SIMULATED_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeId(prefix: string): string {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 12)}`;
}

const FAKE_CARD: Omit<WebhookPaymentMethod, "id"> = {
  brand: "visa",
  last4: "4242",
  expMonth: 12,
  expYear: 2099,
  country: "US",
};

type MockTransaction = { customerId: string; amountCents: number; metadata: Record<string, string> };

/**
 * In-memory provider for local development and tests. Every call resolves
 * successfully after a 1s delay to mimic real network latency, and every ID
 * is fake — nothing here talks to a real payment network. A "saved card" is
 * just an id created the first time createCheckoutSession or
 * chargeSavedPaymentMethod is called for a customer that doesn't have one yet.
 */
export class MockPaymentProvider implements PaymentProvider {
  private customers = new Map<string, { userId: string; email: string }>();
  private cardsByCustomer = new Map<string, string>();
  private transactions = new Map<string, MockTransaction>();
  private payoutRecipients = new Map<string, PayoutRecipient>();

  async createCustomer(userId: string, email: string): Promise<string> {
    await delay(SIMULATED_DELAY_MS);
    const customerId = fakeId("cus");
    this.customers.set(customerId, { userId, email });
    return customerId;
  }

  async createCheckoutSession(
    customerId: string,
    amountCents: number,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    await delay(SIMULATED_DELAY_MS);
    void cancelUrl;
    const reference = fakeId("txn");
    this.transactions.set(reference, { customerId, amountCents, metadata });
    const separator = successUrl.includes("?") ? "&" : "?";
    return `${successUrl}${separator}mock_reference=${reference}`;
  }

  async chargeSavedPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    metadata: Record<string, string> = {}
  ): Promise<{ reference: string; success: boolean }> {
    await delay(SIMULATED_DELAY_MS);
    const reference = fakeId("txn");
    this.transactions.set(reference, { customerId, amountCents, metadata });
    // Lets tests exercise the failed-payment/retry path without a real declined card.
    return { reference, success: paymentMethodId !== "mock_fail" };
  }

  async detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await delay(SIMULATED_DELAY_MS);
    void paymentMethodId;
    this.cardsByCustomer.delete(customerId);
  }

  async getBanks(): Promise<Bank[]> {
    await delay(SIMULATED_DELAY_MS);
    return [
      { name: "Access Bank", code: "044" },
      { name: "First Bank of Nigeria", code: "011" },
      { name: "GTBank", code: "058" },
      { name: "Kuda Bank", code: "50211" },
      { name: "UBA", code: "033" },
      { name: "Zenith Bank", code: "057" },
    ];
  }

  async resolveAccountName(accountNumber: string, bankCode: string): Promise<string> {
    await delay(SIMULATED_DELAY_MS);
    void bankCode;
    if (accountNumber.length !== 10) {
      throw new Error("Could not resolve that account number.");
    }
    return "MOCK TEST ACCOUNT";
  }

  async createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipient> {
    await delay(SIMULATED_DELAY_MS);
    const recipient: PayoutRecipient = {
      provider: "mock",
      recipientCode: fakeId("rcpt"),
      status: "verified",
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountLast4: input.accountNumber.slice(-4),
      accountName: input.name,
      country: input.country ?? "US",
      currency: input.currency,
    };
    this.payoutRecipients.set(recipient.recipientCode, recipient);
    return recipient;
  }

  async getPayoutRecipient(recipientCode: string): Promise<PayoutRecipient> {
    await delay(SIMULATED_DELAY_MS);
    const recipient = this.payoutRecipients.get(recipientCode);
    if (!recipient) {
      return {
        provider: "mock",
        recipientCode,
        status: "failed",
        bankName: "",
        accountNumber: "",
        accountLast4: "",
        accountName: "",
        country: "US",
        currency: "USD",
      };
    }
    return recipient;
  }

  async createPayoutTransfer(
    recipientCode: string,
    amountCents: number,
    reason: string,
    metadata: Record<string, string> = {}
  ): Promise<PayoutTransferResult> {
    await delay(SIMULATED_DELAY_MS);
    void recipientCode;
    void amountCents;
    void reason;
    void metadata;
    return { reference: fakeId("trf"), status: "success" };
  }

  async refundTransaction(
    transactionReference: string,
    amountCents: number,
    metadata: Record<string, string> = {},
  ): Promise<RefundResult> {
    await delay(SIMULATED_DELAY_MS);
    void amountCents;
    // Lets tests exercise the failed-refund path without a real provider error.
    const status = metadata.simulateFailure === "true" ? "failed" : "success";
    return { reference: transactionReference, status };
  }

  async verifyTransaction(reference: string): Promise<WebhookEvent> {
    await delay(SIMULATED_DELAY_MS);
    const transaction = this.transactions.get(reference);
    if (!transaction) {
      return { type: "unknown", customerId: null, paymentMethod: null, amountCents: null, reference, metadata: {} };
    }
    return {
      type: "charge.succeeded",
      customerId: transaction.customerId,
      paymentMethod: { id: this.mockCardId(transaction.customerId), ...FAKE_CARD },
      amountCents: transaction.amountCents,
      reference,
      metadata: transaction.metadata,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface-mandated; mirrors the real provider's raw-payload shape.
  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    void signature;
    const body = typeof payload === "string" || Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
    const reference = body?.reference;
    if (typeof reference === "string") {
      return this.verifyTransaction(reference);
    }
    return { type: "unknown", customerId: null, paymentMethod: null, amountCents: null, reference: null, metadata: {} };
  }

  private mockCardId(customerId: string): string {
    const existing = this.cardsByCustomer.get(customerId);
    if (existing) return existing;
    const cardId = fakeId("card");
    this.cardsByCustomer.set(customerId, cardId);
    return cardId;
  }
}
