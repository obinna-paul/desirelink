jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/discover", () => ({
  ...jest.requireActual("@/lib/discover"),
  searchDiscoverProfiles: jest.fn(),
}));

import { getServerSession } from "next-auth";

import { GET } from "@/app/api/discover/route";
import { prisma } from "@/lib/prisma";
import { searchDiscoverProfiles } from "@/lib/discover";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as { profile: { findUnique: jest.Mock } };
const mockSearch = searchDiscoverProfiles as jest.Mock;

function getRequest(query: string) {
  return new Request(`http://localhost/api/discover${query}`);
}

describe("GET /api/discover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: "profile-1",
      profileType: "EXPLORER",
      locationLat: 0,
      locationLng: 0,
    });
    mockSearch.mockResolvedValue({ profiles: [{ id: "a" }], hasMore: true });
  });

  it("rejects an unauthenticated request", async () => {
    mockSession.mockResolvedValue(null);

    const response = await GET(getRequest("?offset=30"));

    expect(response).toMatchObject({ status: 401 });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("refuses a search-query request - that surface is handled elsewhere", async () => {
    const response = await GET(getRequest("?q=someone&offset=30"));

    expect(response).toMatchObject({ status: 400 });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("parses filters and offset, forwarding them to searchDiscoverProfiles", async () => {
    const response = await GET(getRequest("?gender=Woman&gender=Trans+woman&offset=60"));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ genders: ["Woman", "Trans woman"] }),
      expect.objectContaining({ id: "profile-1" }),
      60,
    );
    expect(response).toMatchObject({ status: 200, body: { profiles: [{ id: "a" }], hasMore: true } });
  });

  it("defaults offset to 0 when absent or garbage", async () => {
    await GET(getRequest("?offset=not-a-number"));

    expect(mockSearch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 0);
  });

  it("works for a viewer with no profile", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const response = await GET(getRequest("?offset=0"));

    expect(mockSearch).toHaveBeenCalledWith(expect.anything(), null, 0);
    expect(response).toMatchObject({ status: 200 });
  });
});
