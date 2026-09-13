import { renderTerms } from "@/lib/spec-test/gender/render";
import { TERM_TABLES, TOKEN_KEYS } from "@/lib/spec-test/gender/terms";
import { expectSymmetricTemplate } from "./symmetry-helper";

describe("renderTerms - basic substitution", () => {
  it("renders every token correctly for male_user (other person rendered female)", () => {
    expect(renderTerms("The {person} you like.", "male_user")).toBe("The woman you like.");
    expect(renderTerms("Many {people}.", "male_user")).toBe("Many women.");
    expect(renderTerms("{They} arrives.", "male_user")).toBe("She arrives.");
    expect(renderTerms("Ask {them}.", "male_user")).toBe("Ask her.");
    expect(renderTerms("It is {their} choice.", "male_user")).toBe("It is her choice.");
    expect(renderTerms("The car is {theirs}.", "male_user")).toBe("The car is hers.");
    expect(renderTerms("{They} did it {themself}.", "male_user")).toBe("She did it herself.");
    expect(renderTerms("Respect {personPoss} privacy.", "male_user")).toBe("Respect woman's privacy.");
  });

  it("renders every token correctly for female_user (other person rendered male)", () => {
    expect(renderTerms("The {person} you like.", "female_user")).toBe("The man you like.");
    expect(renderTerms("Many {people}.", "female_user")).toBe("Many men.");
    expect(renderTerms("Ask {them}.", "female_user")).toBe("Ask him.");
    expect(renderTerms("It is {their} choice.", "female_user")).toBe("It is his choice.");
    expect(renderTerms("The car is {theirs}.", "female_user")).toBe("The car is his.");
    expect(renderTerms("{They} did it {themself}.", "female_user")).toBe("He did it himself.");
    expect(renderTerms("Respect {personPoss} privacy.", "female_user")).toBe("Respect man's privacy.");
  });

  it("renders every token correctly for neutral (no stored form / legacy rows)", () => {
    for (const key of TOKEN_KEYS) {
      const rendered = renderTerms(`{${key}}`, "neutral");
      expect(rendered).toBe(TERM_TABLES.neutral[key]);
    }
  });

  it("capitalizes a token whose brace-name starts uppercase, and only that token", () => {
    expect(renderTerms("{Person} arrives.", "male_user")).toBe("Woman arrives.");
    expect(renderTerms("{Them} first, then {them}.", "female_user")).toBe("Him first, then him.");
    expect(renderTerms("{PersonPoss} choice.", "male_user")).toBe("Woman's choice.");
  });

  it("substitutes every occurrence of a repeated token", () => {
    expect(renderTerms("{person} and {person} again", "male_user")).toBe("woman and woman again");
  });
});

describe("renderTerms - unknown tokens", () => {
  const originalEnv = process.env.NODE_ENV;

  function setNodeEnv(value: string) {
    Object.defineProperty(process.env, "NODE_ENV", { value, configurable: true });
  }

  afterEach(() => {
    setNodeEnv(originalEnv ?? "test");
  });

  it("throws in development for an unknown token", () => {
    setNodeEnv("development");
    expect(() => renderTerms("{typo}", "male_user")).toThrow(/unknown token/i);
  });

  it("strips the braces rather than leaking them in production", () => {
    setNodeEnv("production");
    expect(renderTerms("{typo}", "male_user")).toBe("typo");
    expect(renderTerms("Some {typo} text.", "male_user")).not.toMatch(/[{}]/);
  });
});

describe("renderTerms - term table shape", () => {
  it("gives male_user and female_user genuinely distinct values for every key", () => {
    for (const key of TOKEN_KEYS) {
      expect(TERM_TABLES.male_user[key]).not.toBe(TERM_TABLES.female_user[key]);
    }
  });

  it("gives neutral its own values, distinct from either gendered form", () => {
    for (const key of TOKEN_KEYS) {
      expect(TERM_TABLES.neutral[key]).not.toBe(TERM_TABLES.male_user[key]);
      expect(TERM_TABLES.neutral[key]).not.toBe(TERM_TABLES.female_user[key]);
    }
  });
});

describe("renderTerms - symmetry", () => {
  it("produces byte-identical output across forms once gendered words are normalized, across every token", () => {
    expectSymmetricTemplate("The {person} you like.");
    expectSymmetricTemplate("Many {people} feel this way.");
    expectSymmetricTemplate("{They} said hello, then left without {them}.");
    expectSymmetricTemplate("It is {their} choice, not {theirs} to make for {themself}.");
    expectSymmetricTemplate("Respect {personPoss} privacy - {Their} boundaries matter.");
  });

  it("would fail if a template hid gendered content outside a token (sanity-checks the helper itself)", () => {
    expect(() => expectSymmetricTemplate("The woman you like.")).toThrow();
  });
});
