import { MockPaymentProvider } from "./mock-provider";
import { StripeProvider } from "./stripe-provider";
import type { PaymentProvider } from "./types";

function createPaymentProvider(): PaymentProvider {
  if (process.env.USE_MOCK_PAYMENTS === "true") {
    return new MockPaymentProvider();
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Set USE_MOCK_PAYMENTS=true to use the mock provider in development."
    );
  }

  return new StripeProvider(secretKey);
}

const globalForPayments = globalThis as unknown as {
  paymentProvider: PaymentProvider | undefined;
};

export const paymentProvider: PaymentProvider = globalForPayments.paymentProvider ?? createPaymentProvider();

if (process.env.NODE_ENV !== "production") globalForPayments.paymentProvider = paymentProvider;

export * from "./types";
