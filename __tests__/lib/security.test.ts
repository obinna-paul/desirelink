import { isCronAuthorized } from "@/lib/security/cron";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, readJson } from "@/lib/security/request";
import { allowedImageTypesLabel, isAllowedImageFile } from "@/lib/security/uploads";

describe("security helpers", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalNodeEnv,
      configurable: true,
    });
    process.env.VERCEL_ENV = originalVercelEnv;
    jest.restoreAllMocks();
  });

  it("limits repeated attempts inside the configured window", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_000);

    expect(checkRateLimit("test:limited", { limit: 2, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit("test:limited", { limit: 2, windowMs: 60_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit("test:limited", { limit: 2, windowMs: 60_000 })).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("requires the configured cron bearer token", () => {
    process.env.CRON_SECRET = "secret";

    expect(isCronAuthorized(new Request("http://localhost/api/cron/test"))).toBe(false);
    expect(
      isCronAuthorized(
        new Request("http://localhost/api/cron/test", {
          headers: { authorization: "Bearer secret" },
        })
      )
    ).toBe(true);
  });

  it("does not allow production cron execution without a secret", () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_ENV = "production";

    expect(isCronAuthorized(new Request("http://localhost/api/cron/test"))).toBe(false);
  });

  it("reads client IP and handles invalid JSON without throwing", async () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
      method: "POST",
      body: "{",
    });

    expect(getClientIp(req)).toBe("203.0.113.10");
    await expect(readJson(req)).resolves.toBeNull();
  });

  it("allowlists only supported image MIME types", () => {
    expect(isAllowedImageFile(new File(["ok"], "image.webp", { type: "image/webp" }))).toBe(true);
    expect(isAllowedImageFile(new File(["svg"], "image.svg", { type: "image/svg+xml" }))).toBe(false);
    expect(allowedImageTypesLabel()).toContain("JPEG");
  });
});
