/** Every Profile is created with this placeholder (see app/api/signup/route.ts and
 * lib/auth.ts) since gender isn't asked for at signup - the /onboarding/gender gate in
 * app/(app)/layout.tsx checks for exactly this value to decide who still needs to pick a
 * real one. Deliberately not one of GENDER_OPTIONS below, so it can never be select-able
 * as a genuine choice by mistake. */
export const GENDER_UNSPECIFIED = "unspecified";

export const GENDER_OPTIONS = [
  "Woman",
  "Man",
  "Non-binary",
  "Trans woman",
  "Trans man",
  "Genderfluid",
  "Other",
  "Prefer not to say",
];

// Discover's quick Men/Women filter buckets two of the eight identity options each - the
// other four (Non-binary, Genderfluid, Other, Prefer not to say) and the unspecified
// default intentionally match neither bucket, so a profile only ever shows up under a
// bucket it actually chose.
export const MEN_GENDER_VALUES = ["Man", "Trans man"];
export const WOMEN_GENDER_VALUES = ["Woman", "Trans woman"];

export const ORIENTATION_OPTIONS = [
  "Straight",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Queer",
  "Asexual",
  "Prefer not to say",
];
