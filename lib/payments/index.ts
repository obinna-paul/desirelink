import "server-only";

import { MockPaymentProvider } from "./mock-provider";
import { PaystackProvider } from "./paystack-provider";
import { StripeProvider } from "./stripe-provider";
import type { PaymentProvider } from "./types";

/**
 * Paystack is the active real provider (set PAYMENT_PROVIDER=stripe to use
 * the Stripe implementation instead — both satisfy the same PaymentProvider
 * interface). USE_MOCK_PAYMENTS=true overrides either for local dev/tests.
 */
function createPaymentProvider(): PaymentProvider {
  if (process.env.USE_MOCK_PAYMENTS === "true") {
    return new MockPaymentProvider();
  }

  if (process.env.PAYMENT_PROVIDER === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Set USE_MOCK_PAYMENTS=true to use the mock provider in development."
      );
    }
    return new StripeProvider(secretKey);
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

export const paymentProvider: PaymentProvider = globalForPayments.paymentProvider ?? createPaymentProvider();

if (process.env.NODE_ENV !== "production") globalForPayments.paymentProvider = paymentProvider;

export * from "./types";
