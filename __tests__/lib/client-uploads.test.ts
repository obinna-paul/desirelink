const mockFindPreviousUploads = jest.fn();
const mockResumeFromPreviousUpload = jest.fn();
const mockAbort = jest.fn().mockResolvedValue(undefined);
const mockFindUploadsByFingerprint = jest.fn();
const mockRemoveStoredUpload = jest.fn();

jest.mock("tus-js-client", () => ({
  Upload: jest.fn(),
  defaultOptions: {
    urlStorage: {
      findUploadsByFingerprint: (...args: unknown[]) => mockFindUploadsByFingerprint(...args),
      removeUpload: (...args: unknown[]) => mockRemoveStoredUpload(...args),
    },
  },
}));

import * as tus from "tus-js-client";
import { discardVideoUpload, uploadVideoDirect } from "@/lib/client-uploads";

const mockUpload = tus.Upload as unknown as jest.Mock;

type MockTusOptions = {
  endpoint?: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onSuccess?: (payload: unknown) => void;
  onError?: (error: unknown) => void;
};

describe("direct video uploads", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockFindPreviousUploads.mockReset();
    mockResumeFromPreviousUpload.mockReset();
    mockAbort.mockClear();
    mockFindUploadsByFingerprint.mockReset().mockResolvedValue([]);
    mockRemoveStoredUpload.mockReset().mockResolvedValue(undefined);
    mockUpload.mockReset();
    mockFindPreviousUploads.mockResolvedValue([
      {
        size: 1_000,
        metadata: {},
        creationTime: new Date().toISOString(),
        urlStorageKey: "stored-key",
        uploadUrl: "https://video.bunnycdn.com/tusupload/stored-upload",
        parallelUploadUrls: null,
      },
    ]);
    mockUpload.mockImplementation((_file: File, options: MockTusOptions) => ({
      findPreviousUploads: mockFindPreviousUploads,
      resumeFromPreviousUpload: mockResumeFromPreviousUpload,
      abort: mockAbort,
      start: () => {
        options.onProgress?.(1_000, 1_000);
        options.onSuccess?.({});
      },
    }));
  });

  it("reuses a saved Bunny authorization and resumes its acknowledged upload URL", async () => {
    const file = new File([new Uint8Array(1_000)], "premium.mp4", {
      type: "video/mp4",
      lastModified: 123,
    });
    const auth = {
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "12345",
      videoId: "video-id",
      authorizationSignature: "signed",
      authorizationExpire: Math.floor(Date.now() / 1000) + 60 * 60,
      contentType: "video/mp4",
      playbackUrl: "https://videos.example.test/video-id/playlist.m3u8",
    };
    const cacheKey = `udala:bunny-upload:v2:${encodeURIComponent(
      [file.name, file.size, file.lastModified, file.type].join(":"),
    )}`;
    window.localStorage.setItem(cacheKey, JSON.stringify(auth));

    await expect(uploadVideoDirect(file, "/api/upload/post-media")).resolves.toMatchObject({
      url: auth.playbackUrl,
    });

    expect(mockFindPreviousUploads).toHaveBeenCalledTimes(1);
    expect(mockResumeFromPreviousUpload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadUrl: expect.stringContaining("stored-upload") }),
    );
    expect(window.localStorage.getItem(cacheKey)).toBeNull();
  });

  it("returns success when Bunny accepted the file but the browser lost the final receipt", async () => {
    const file = new File([new Uint8Array(1_000)], "premium.mp4", {
      type: "video/mp4",
      lastModified: 456,
    });
    const auth = {
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "12345",
      videoId: "accepted-video-id",
      authorizationSignature: "signed",
      authorizationExpire: Math.floor(Date.now() / 1000) + 60 * 60,
      contentType: "video/mp4",
      playbackUrl: "https://videos.example.test/accepted-video-id/playlist.m3u8",
    };
    const cacheKey = `udala:bunny-upload:v2:${encodeURIComponent(
      [file.name, file.size, file.lastModified, file.type].join(":"),
    )}`;
    window.localStorage.setItem(cacheKey, JSON.stringify(auth));
    mockUpload.mockImplementation((_file: File, options: MockTusOptions) => ({
      findPreviousUploads: mockFindPreviousUploads,
      resumeFromPreviousUpload: mockResumeFromPreviousUpload,
      abort: mockAbort,
      start: () => {
        options.onProgress?.(1_000, 1_000);
        options.onError?.({
          originalResponse: {
            getStatus: () => 415,
            getBody: () => "response interrupted after upload",
          },
        });
      },
    }));
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ result: "accepted", status: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(uploadVideoDirect(file, "/api/upload/post-media")).resolves.toMatchObject({
      url: auth.playbackUrl,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/bunny-status",
      expect.objectContaining({ method: "POST" }),
    );
    expect(window.localStorage.getItem(cacheKey)).toBeNull();
    fetchMock.mockRestore();
  });

  it("switches network routes when the opening TUS handshake transfers no bytes", async () => {
    const file = new File([new Uint8Array(1_000)], "fallback.mp4", {
      type: "video/mp4",
      lastModified: 654,
    });
    const auth = {
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "12345",
      videoId: "fallback-video-id",
      authorizationSignature: "signed",
      authorizationExpire: Math.floor(Date.now() / 1000) + 60 * 60,
      contentType: "video/mp4",
      playbackUrl: "https://videos.example.test/fallback-video-id/playlist.m3u8",
    };
    const cacheKey = `udala:bunny-upload:v2:${encodeURIComponent(
      [file.name, file.size, file.lastModified, file.type].join(":"),
    )}`;
    window.localStorage.setItem(cacheKey, JSON.stringify(auth));
    mockFindPreviousUploads.mockResolvedValue([]);
    const endpoints: Array<string | undefined> = [];
    let attempt = 0;
    mockUpload.mockImplementation((_file: File, options: MockTusOptions) => ({
      findPreviousUploads: mockFindPreviousUploads,
      resumeFromPreviousUpload: mockResumeFromPreviousUpload,
      abort: mockAbort,
      start: () => {
        endpoints.push(options.endpoint);
        if (attempt === 0) {
          attempt += 1;
          options.onError?.({});
          return;
        }
        options.onProgress?.(1_000, 1_000);
        options.onSuccess?.({});
      },
    }));

    await expect(uploadVideoDirect(file, "/api/upload/post-media")).resolves.toMatchObject({
      url: auth.playbackUrl,
    });

    expect(endpoints).toEqual([
      "https://video.bunnycdn.com/tusupload",
      "/api/upload/bunny-tus",
    ]);
  });

  it("removes a discarded resumable upload from Bunny and local resume storage", async () => {
    const file = new File([new Uint8Array(1_000)], "discard.mp4", {
      type: "video/mp4",
      lastModified: 789,
    });
    const auth = {
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      libraryId: "12345",
      videoId: "discard-video-id",
      authorizationSignature: "signed",
      authorizationExpire: Math.floor(Date.now() / 1000) + 60 * 60,
      contentType: "video/mp4",
      playbackUrl: "https://videos.example.test/discard-video-id/playlist.m3u8",
    };
    const cacheKey = `udala:bunny-upload:v2:${encodeURIComponent(
      [file.name, file.size, file.lastModified, file.type].join(":"),
    )}`;
    window.localStorage.setItem(cacheKey, JSON.stringify(auth));
    mockFindUploadsByFingerprint
      .mockResolvedValueOnce([
        {
          size: file.size,
          metadata: {},
          creationTime: new Date().toISOString(),
          urlStorageKey: "direct-key",
          uploadUrl: "https://video.bunnycdn.com/tusupload/direct",
          parallelUploadUrls: null,
        },
      ])
      .mockResolvedValueOnce([]);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );

    await discardVideoUpload(file);

    expect(window.localStorage.getItem(cacheKey)).toBeNull();
    expect(mockRemoveStoredUpload).toHaveBeenCalledWith("direct-key");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/bunny-abort",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    fetchMock.mockRestore();
  });
});
