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
jest.mock("@/lib/bunny-stream", () => ({
  verifyBunnyUploadAuthorization: jest.fn(),
  getBunnyVideoUploadState: jest.fn(),
  classifyBunnyVideoUploadState: jest.fn(),
}));

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/upload/bunny-status/route";
import {
  classifyBunnyVideoUploadState,
  getBunnyVideoUploadState,
  verifyBunnyUploadAuthorization,
} from "@/lib/bunny-stream";

const mockSession = getServerSession as jest.Mock;
const mockVerify = verifyBunnyUploadAuthorization as jest.Mock;
const mockGetState = getBunnyVideoUploadState as jest.Mock;
const mockClassify = classifyBunnyVideoUploadState as jest.Mock;

const auth = {
  videoId: "video-1",
  libraryId: "12345",
  authorizationExpire: 2_000_000_000,
  authorizationSignature: "signed",
};

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/upload/bunny-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/upload/bunny-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockVerify.mockReturnValue(true);
  });

  it("returns Bunny's authoritative readiness state for the signed video", async () => {
    const state = {
      status: 2,
      storageSize: 1_024,
      hasOriginal: true,
      encodeProgress: 4,
      availableResolutions: null,
    };
    mockGetState.mockResolvedValue(state);
    mockClassify.mockReturnValue("processing");

    const response = await POST(postRequest(auth));

    expect(response).toMatchObject({
      status: 200,
      body: {
        result: "processing",
        status: 2,
        storageSize: 1_024,
        encodeProgress: 4,
        availableResolutions: null,
      },
    });
    expect(mockVerify).toHaveBeenCalledWith(auth);
    expect(mockGetState).toHaveBeenCalledWith("video-1");
  });

  it("rejects a lookup whose upload signature is not valid", async () => {
    mockVerify.mockReturnValue(false);

    const response = await POST(postRequest(auth));

    expect(response).toMatchObject({ status: 403 });
    expect(mockGetState).not.toHaveBeenCalled();
  });
});
