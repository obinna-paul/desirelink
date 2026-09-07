import { clearSplashSeen, hasSeenSplash, markSplashSeen } from "@/lib/app-splash-storage";

describe("app-splash-storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("reports unseen until marked seen", () => {
    expect(hasSeenSplash()).toBe(false);

    markSplashSeen();

    expect(hasSeenSplash()).toBe(true);
    expect(window.sessionStorage.getItem("udala:splash-seen")).toBe("1");
  });

  it("reports unseen again after being cleared", () => {
    markSplashSeen();
    expect(hasSeenSplash()).toBe(true);

    clearSplashSeen();

    expect(hasSeenSplash()).toBe(false);
    expect(window.sessionStorage.getItem("udala:splash-seen")).toBeNull();
  });

  it("degrades to unseen, and never throws, when sessionStorage is unavailable", () => {
    const real = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
        removeItem: () => {
          throw new Error("storage disabled");
        },
      },
    });

    try {
      expect(hasSeenSplash()).toBe(false);
      expect(() => markSplashSeen()).not.toThrow();
      expect(() => clearSplashSeen()).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: real });
    }
  });
});
