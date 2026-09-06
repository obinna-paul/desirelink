const DEFAULT_PAYMENT_CURRENCY = "NGN";

export function getPaymentCurrency(): string {
  return (process.env.PAYSTACK_CURRENCY || DEFAULT_PAYMENT_CURRENCY)
    .trim()
    .toUpperCase();
}

export function mockPaymentsRequested(): boolean {
  return process.env.USE_MOCK_PAYMENTS === "true";
}

export function requiresLivePayments(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function assertPaymentEnvironmentIsSafe(): void {
  if (!requiresLivePayments()) return;

  if (mockPaymentsRequested()) {
    throw new Error(
      "Mock payments are disabled in production. Remove USE_MOCK_PAYMENTS or set it to false.",
    );
  }

  if (process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error(
      "A Paystack test key cannot activate subscriptions in production. Configure a live secret key.",
    );
  }
}

export function getPaymentProviderName(): "mock" | "paystack" {
  assertPaymentEnvironmentIsSafe();
  return mockPaymentsRequested() ? "mock" : "paystack";
}
