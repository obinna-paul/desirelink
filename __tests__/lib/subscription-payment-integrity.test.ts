import {
  assertProviderTierPaymentIntegrity,
  PaymentIntegrityError,
} from "@/lib/payments/webhook-handler";
import { getSubscriptionPeriod } from "@/lib/payments/subscription-period";
import type { WebhookEvent } from "@/lib/payments/types";
import { assertPaymentEnvironmentIsSafe } from "@/lib/payments/config";

function successfulEvent(
  overrides: Partial<WebhookEvent> = {},
): WebhookEvent {
  return {
    type: "charge.succeeded",
    customerId: "CUS_subscriber",
    paymentMethod: null,
    amountCents: 500_000,
    currency: "NGN",
    environment: "live",
    reference: "ref_subscription",
    metadata: { kind: "provider_tier", pendingId: "sub_pending" },
    ...overrides,
  };
}

describe("subscription payment integrity", () => {
  const expected = {
    pendingId: "sub_pending",
    amountCents: 500_000,
    customerId: "CUS_subscriber",
  };

  beforeEach(() => {
    process.env.PAYSTACK_CURRENCY = "NGN";
  });

  it("accepts a matching verified charge", () => {
    expect(() =>
      assertProviderTierPaymentIntegrity(successfulEvent(), expected),
    ).not.toThrow();
  });

  it.each([
    ["wrong amount", { amountCents: 100 }],
    ["wrong currency", { currency: "USD" }],
    ["wrong customer", { customerId: "CUS_someone_else" }],
    ["missing customer", { customerId: null }],
  ])("rejects a charge with the %s", (_label, overrides) => {
    expect(() =>
      assertProviderTierPaymentIntegrity(successfulEvent(overrides), expected),
    ).toThrow(PaymentIntegrityError);
  });
});

describe("one-month subscription periods", () => {
  it("clamps January 31 to the final day of February", () => {
    const start = new Date("2028-01-31T14:25:30.000Z");
    const period = getSubscriptionPeriod(start);

    expect(period.startsAt.toISOString()).toBe("2028-01-31T14:25:30.000Z");
    expect(period.endsAt.toISOString()).toBe("2028-02-29T14:25:30.000Z");
  });

  it("preserves the day and time when the next month contains it", () => {
    const { endsAt } = getSubscriptionPeriod(
      new Date("2026-08-15T09:10:11.000Z"),
    );

    expect(endsAt.toISOString()).toBe("2026-09-15T09:10:11.000Z");
  });
});

describe("production payment configuration", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalMockPayments = process.env.USE_MOCK_PAYMENTS;
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;

  afterEach(() => {
    process.env.VERCEL_ENV = originalVercelEnv;
    process.env.USE_MOCK_PAYMENTS = originalMockPayments;
    process.env.PAYSTACK_SECRET_KEY = originalSecret;
  });

  it("refuses to run the mock provider in public production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.USE_MOCK_PAYMENTS = "true";
    process.env.PAYSTACK_SECRET_KEY = "sk_live_example";

    expect(() => assertPaymentEnvironmentIsSafe()).toThrow(
      "Mock payments are disabled in production",
    );
  });

  it("refuses to fulfill test-key payments in public production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.USE_MOCK_PAYMENTS = "false";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_example";

    expect(() => assertPaymentEnvironmentIsSafe()).toThrow(
      "A Paystack test key cannot activate subscriptions in production",
    );
  });
});
