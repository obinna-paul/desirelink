// Client-safe. Substitutes the terms.ts vocabulary into a canonical template string
// (docs/spec-test-gender-implementation-plan.md §6, principle 3: "one canonical string,
// rendered - not three authored copies"). A token's own case signals how it renders:
// `{person}` renders lowercase, `{Person}` renders with its first letter capitalized - so one
// term table covers both sentence-medial and sentence-initial use without doubling its keys.

import { TERM_TABLES, TOKEN_KEYS, type RenderForm, type TokenKey } from "@/lib/spec-test/gender/terms";

const TOKEN_PATTERN = /\{([A-Za-z]+)\}/g;

function isKnownToken(key: string): key is TokenKey {
  return (TOKEN_KEYS as readonly string[]).includes(key);
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Renders every `{token}` in `template` for the given form. An unknown token (a typo in
 * content, e.g. `{persn}`) throws in development - a content mistake should fail loudly
 * before it ships - and degrades to the bare word with its braces stripped in production,
 * so a taker never sees a literal "{token}" on the page.
 */
export function renderTerms(template: string, form: RenderForm, environment = process.env.NODE_ENV): string {
  const table = TERM_TABLES[form];

  return template.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
    const isCapitalized = rawToken.charAt(0) === rawToken.charAt(0).toUpperCase();
    const key = (rawToken.charAt(0).toLowerCase() + rawToken.slice(1)) as TokenKey;

    if (!isKnownToken(key)) {
      if (environment !== "production") {
        throw new Error(`renderTerms: unknown token "{${rawToken}}" (form: ${form})`);
      }
      return rawToken;
    }

    const value = table[key];
    return isCapitalized ? capitalize(value) : value;
  });
}
