import { buildMetricBuckets, getAdminTransactionSource } from "@/lib/admin/metric-helpers";

describe("admin metric helpers", () => {
  test("seven-day buckets include the current calendar day", () => {
    const now = new Date(2026, 8, 6, 15, 30);
    const { buckets, rangeStart, rangeEnd } = buildMetricBuckets("7d", now);

    expect(buckets).toHaveLength(7);
    expect(rangeStart).toEqual(new Date(2026, 7, 31));
    expect(rangeEnd).toEqual(new Date(2026, 8, 7));
    expect(buckets.at(-1)?.start).toEqual(new Date(2026, 8, 6));
    expect(buckets.at(-1)?.end.getTime()).toBeGreaterThan(now.getTime());
  });

  test("classifies each supported payment source", () => {
    expect(getAdminTransactionSource({ serviceBookingId: "booking" })).toBe("Service booking");
    expect(getAdminTransactionSource({ providerSubscriptionId: "subscription" })).toBe("Subscription");
    expect(getAdminTransactionSource({ tierId: "legacy-tier" })).toBe("Subscription");
    expect(getAdminTransactionSource({})).toBe("Hearts purchase");
  });

  test("twelve-month range uses complete calendar months", () => {
    const { buckets, rangeStart, rangeEnd } = buildMetricBuckets("12mo", new Date(2026, 8, 6, 15, 30));

    expect(buckets).toHaveLength(12);
    expect(rangeStart).toEqual(new Date(2025, 9, 1));
    expect(rangeEnd).toEqual(new Date(2026, 9, 1));
    expect(buckets[0].label).toBe("Oct");
    expect(buckets.at(-1)?.label).toBe("Sep");
  });
});
