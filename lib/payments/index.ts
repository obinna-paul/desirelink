import "server-only";

import { MockPaymentProvider } from "./mock-provider";
import { PaystackProvider } from "./paystack-provider";
import type { PaymentProvider } from "./types";

/**
 * Paystack is the active real provider. USE_MOCK_PAYMENTS=true overrides it
 * for local development and tests.
 */
function createPaymentProvider(): PaymentProvider {
  if (process.env.USE_MOCK_PAYMENTS === "true") {
    return new MockPaymentProvider();
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Set USE_MOCK_PAYMENTS=true to use the mock provider in development."
    );
  }
  return new PaystackProvider(secretKey);
}

const globalForPayments = globalThis as unknown as {
  paymentProvider: PaymentProvider | undefined;
};

function getPaymentProvider(): PaymentProvider {
  const provider = globalForPayments.paymentProvider ?? createPaymentProvider();
  if (process.env.NODE_ENV !== "production") globalForPayments.paymentProvider = provider;
  return provider;
}

export const paymentProvider: PaymentProvider = new Proxy({} as PaymentProvider, {
  get(_target, property: keyof PaymentProvider) {
    const value = getPaymentProvider()[property];
    return typeof value === "function" ? value.bind(getPaymentProvider()) : value;
  },
});

export * from "./types";
