// jsdom doesn't implement ReadableStream, which next/og's ImageResponse (built on the web
// Response API) needs internally - polyfill from Node's own stream/web before anything else
// in this file touches it.
import { ReadableStream } from "stream/web";
Object.assign(globalThis, { ReadableStream });

jest.mock("@/lib/spec-test", () => ({ getSpecTestReading: jest.fn() }));

import Image, { size, contentType } from "@/app/spec-test/result/[id]/opengraph-image";
import { getSpecTestReading } from "@/lib/spec-test";

const mockGetReading = getSpecTestReading as jest.Mock;

describe("Spec Test share card", () => {
  beforeEach(() => jest.clearAllMocks());

  it("declares the expected image dimensions and content type", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
  });

  it("renders a PNG response for a v2 result without throwing", async () => {
    mockGetReading.mockResolvedValue({
      version: "v2",
      copy: { primarySpec: "quiet_fire", headline: { name: "Quiet Fire", tagline: "Composed, private, observant and surprisingly intense." } },
    });

    const response = await Image({ params: { id: "result-1" } });
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("renders a fallback card when the result is missing, without throwing", async () => {
    mockGetReading.mockResolvedValue(null);
    const response = await Image({ params: { id: "missing" } });
    expect(response).toBeInstanceOf(Response);
  });
});
