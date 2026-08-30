import { createHmac } from "crypto";

import type {
  PaymentProvider,
  PayoutRecipient,
  PayoutRecipientInput,
  PayoutTransferResult,
  WebhookEvent,
  WebhookPaymentMethod,
} from "./types";

const PAYSTACK_API_BASE = "https://api.paystack.co";

type PaystackResponse<T> = { status: boolean; message: string; data: T };

type PaystackAuthorization = {
  authorization_code: string;
  card_type: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  country_code: string;
  reusable: boolean;
};

type PaystackCustomer = { customer_code: string; email: string; authorizations?: PaystackAuthorization[] };

type PaystackTransactionData = {
  status: string;
  reference: string;
  amount: number;
  customer: { customer_code: string; email: string };
  authorization?: PaystackAuthorization;
  metadata?: Record<string, string> | string;
};

type PaystackTransferRecipientData = {
  recipient_code: string;
  active?: boolean;
  currency?: string;
  details?: {
    account_number?: string;
    account_name?: string;
    bank_name?: string;
  };
  metadata?: Record<string, string> | string;
};

type PaystackTransferData = {
  reference: string;
  status: string;
};

function toWebhookPaymentMethod(authorization: PaystackAuthorization | undefined): WebhookPaymentMethod | null {
  if (!authorization) return null;
  return {
    id: authorization.authorization_code,
    brand: authorization.card_type,
    last4: authorization.last4,
    expMonth: Number(authorization.exp_month),
    expYear: Number(authorization.exp_year),
    country: authorization.country_code,
  };
}

/** Paystack's transaction currency for this account. The merchant account must support whatever currency is charged. */
function currency(): string {
  return process.env.PAYSTACK_CURRENCY ?? "NGN";
}

function normalizeRecipient(data: PaystackTransferRecipientData): PayoutRecipient {
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  return {
    provider: "paystack",
    recipientCode: data.recipient_code,
    status: data.active === false ? "pending" : "verified",
    bankName: data.details?.bank_name ?? metadata.bankName ?? "",
    accountLast4: data.details?.account_number?.slice(-4) ?? "",
    accountName: data.details?.account_name ?? "",
    country: metadata.country ?? "",
    currency: data.currency ?? metadata.currency ?? currency(),
  };
}

function normalizeTransferStatus(status: string): PayoutTransferResult["status"] {
  if (status === "success") return "success";
  if (status === "failed" || status === "reversed") return "failed";
  return "pending";
}

export class PaystackProvider implements PaymentProvider {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as PaystackResponse<T>;
    if (!res.ok || !json.status) {
      throw new Error(`Paystack API error: ${json.message ?? res.statusText}`);
    }
    return json.data;
  }

  async createCustomer(userId: string, email: string): Promise<string> {
    const customer = await this.request<PaystackCustomer>("POST", "/customer", {
      email,
      metadata: { userId },
    });
    return customer.customer_code;
  }

  private async getCustomerEmail(customerId: string): Promise<string> {
    const customer = await this.request<PaystackCustomer>("GET", `/customer/${customerId}`);
    return customer.email;
  }

  async createCheckoutSession(
    customerId: string,
    amountCents: number,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, string> = {}
  ): Promise<string> {
    void cancelUrl; // Paystack's hosted checkout has no separate cancel URL — an abandoned checkout simply never returns.
    const email = await this.getCustomerEmail(customerId);

    const transaction = await this.request<{ authorization_url: string }>("POST", "/transaction/initialize", {
      email,
      amount: amountCents,
      currency: currency(),
      callback_url: successUrl,
      metadata: { ...metadata, customerId },
    });

    return transaction.authorization_url;
  }

  async chargeSavedPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    amountCents: number,
    metadata: Record<string, string> = {}
  ): Promise<{ reference: string; success: boolean }> {
    const email = await this.getCustomerEmail(customerId);

    const transaction = await this.request<PaystackTransactionData>("POST", "/transaction/charge_authorization", {
      authorization_code: paymentMethodId,
      email,
      amount: amountCents,
      currency: currency(),
      metadata: { ...metadata, customerId },
    });

    return { reference: transaction.reference, success: transaction.status === "success" };
  }

  async detachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    void customerId; // Paystack's deactivate endpoint is keyed on the authorization code alone.
    await this.request("POST", "/customer/deactivate_authorization", { authorization_code: paymentMethodId });
  }

  async createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipient> {
    const recipient = await this.request<PaystackTransferRecipientData>("POST", "/transferrecipient", {
      type: input.recipientType ?? "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency,
      metadata: {
        bankName: input.bankName,
        country: input.country ?? "",
        currency: input.currency,
      },
    });
    return normalizeRecipient(recipient);
  }

  async getPayoutRecipient(recipientCode: string): Promise<PayoutRecipient> {
    const recipient = await this.request<PaystackTransferRecipientData>("GET", `/transferrecipient/${recipientCode}`);
    return normalizeRecipient(recipient);
  }

  async createPayoutTransfer(
    recipientCode: string,
    amountCents: number,
    reason: string,
    metadata: Record<string, string> = {}
  ): Promise<PayoutTransferResult> {
    const reference = `udala_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const transfer = await this.request<PaystackTransferData>("POST", "/transfer", {
      source: "balance",
      amount: amountCents,
      recipient: recipientCode,
      reason,
      reference,
      metadata,
    });

    return { reference: transfer.reference, status: normalizeTransferStatus(transfer.status) };
  }

  async verifyTransaction(reference: string): Promise<WebhookEvent> {
    const data = await this.request<PaystackTransactionData>("GET", `/transaction/verify/${reference}`);
    const metadata =
      data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, string>) : {};

    return {
      type: data.status === "success" ? "charge.succeeded" : "charge.failed",
      customerId: data.customer.customer_code,
      paymentMethod: toWebhookPaymentMethod(data.authorization),
      amountCents: data.amount,
      reference: data.reference,
      metadata,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface-mandated; Paystack requires the raw request body here for signature verification.
  async handleWebhook(payload: any, signature: string): Promise<WebhookEvent> {
    const raw = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
    const expectedSignature = createHmac("sha512", this.secretKey).update(raw).digest("hex");
    if (expectedSignature !== signature) {
      throw new Error("Invalid Paystack webhook signature");
    }

    const body = JSON.parse(raw.toString("utf8")) as {
      event: string;
      data: PaystackTransactionData & Partial<PaystackTransferData>;
    };
    const data = body.data;
    const metadata =
      data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, string>) : {};

    if (body.event === "transfer.success" || body.event === "transfer.failed" || body.event === "transfer.reversed") {
      return {
        type: body.event === "transfer.success" ? "transfer.succeeded" : "transfer.failed",
        customerId: null,
        paymentMethod: null,
        amountCents: data.amount ?? null,
        reference: data.reference ?? null,
        metadata,
      };
    }

    if (body.event !== "charge.success") {
      return {
        type: "unknown",
        customerId: data.customer?.customer_code ?? null,
        paymentMethod: toWebhookPaymentMethod(data.authorization),
        amountCents: data.amount ?? null,
        reference: data.reference ?? null,
        metadata,
      };
    }

    return {
      type: data.status === "success" ? "charge.succeeded" : "charge.failed",
      customerId: data.customer.customer_code,
      paymentMethod: toWebhookPaymentMethod(data.authorization),
      amountCents: data.amount,
      reference: data.reference,
      metadata,
    };
  }
}
