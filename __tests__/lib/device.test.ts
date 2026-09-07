import { isMobileDevice } from "@/lib/device";

function setDevice(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

describe("isMobileDevice", () => {
  it("is true for phone user agents", () => {
    setDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148");
    expect(isMobileDevice()).toBe(true);

    setDevice("Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile");
    expect(isMobileDevice()).toBe(true);
  });

  it("is true for a multi-touch device even without a mobile-flagged user agent", () => {
    setDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", 5);
    expect(isMobileDevice()).toBe(true);
  });

  it("is false for an ordinary desktop/laptop browser", () => {
    setDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", 0);
    expect(isMobileDevice()).toBe(false);
  });
});
