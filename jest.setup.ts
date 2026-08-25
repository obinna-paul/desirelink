import "@testing-library/jest-dom";
import "whatwg-fetch";
import { TextDecoder, TextEncoder } from "util";

jest.setTimeout(15_000);

Object.assign(globalThis, { TextDecoder, TextEncoder });

Response.json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

const { server } = require("@/test/msw/server") as typeof import("@/test/msw/server");
const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input, init) => {
  if (typeof input === "string" && input.startsWith("/")) {
    return originalFetch(`http://localhost${input}`, init);
  }

  return originalFetch(input, init);
}) as typeof fetch;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.refresh.mockClear();
});
afterAll(() => server.close());

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
};

let mockPathname = "/";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
  redirect: jest.fn(),
  notFound: jest.fn(),
  __setPathname: (nextPathname: string) => {
    mockPathname = nextPathname;
  },
  __mockRouter: mockRouter,
}));
