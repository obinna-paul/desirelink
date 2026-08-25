const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  testMatch: ["<rootDir>/__tests__/**/*.(test|spec).{ts,tsx}"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/references/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/test/mocks/server-only.ts",
  },
  collectCoverageFrom: [
    "app/signup/page.tsx",
    "app/api/events/[id]/rsvp/route.ts",
    "app/api/premium/subscribe/route.ts",
    "components/home/profile-card.tsx",
    "components/layout/bottom-nav.tsx",
    "components/layout/sidebar-nav.tsx",
    "lib/circles.ts",
    "lib/recommendation-scoring.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 65,
      lines: 70,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
