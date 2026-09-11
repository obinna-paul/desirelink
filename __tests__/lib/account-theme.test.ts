import { getAccountThemeClass } from "@/lib/account-theme";

describe("getAccountThemeClass", () => {
  it("gives Creator the default (unthemed) purple root palette", () => {
    expect(getAccountThemeClass("CREATOR")).toBe("");
  });

  it("gives Seeker its own orange accent", () => {
    expect(getAccountThemeClass("SEEKER")).toBe("theme-seeker");
  });

  it("gives Explorer the existing olive accent", () => {
    expect(getAccountThemeClass("EXPLORER")).toBe("theme-olive");
  });
});
