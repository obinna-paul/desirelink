/**
 * The wait that a creator reported as "stays at 80% till forever": what the composer does
 * between "the file is on Bunny" and "the post can be published".
 */
import {
  MAX_PREMIUM_VIDEO_DURATION_SECONDS,
} from "@/lib/video-upload-constraints";
import {
  isResumableVideoWaitError,
  resumeVideoProcessing,
  VideoProcessingCancelledError,
  VideoStillProcessingError,
} from "@/lib/client-uploads";

const VIDEO_ID = "video-guid";
const PLAYLIST = "https://cdn.example.net/video-guid/playlist.m3u8";

type StatusBody = Record<string, unknown>;

function statusResponse(body: StatusBody, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Drives the poll's own sleeps forward without spending real seconds. */
async function runWait<T>(promise: Promise<T>, ticks = 40): Promise<T> {
  for (let tick = 0; tick < ticks; tick += 1) {
    // Let every pending fetch/json microtask settle before the next sleep elapses.
    for (let flush = 0; flush < 12; flush += 1) await Promise.resolve();
    jest.advanceTimersByTime(5_000);
  }
  for (let flush = 0; flush < 12; flush += 1) await Promise.resolve();
  return promise;
}

describe("waiting for Bunny to process a video", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stops waiting as soon as the video is playable, not when every rendition is done", async () => {
    fetchMock.mockImplementation(async (input: string) => {
      if (input === PLAYLIST) return statusResponse({}, 200);
      return statusResponse({
        ready: false,
        playable: true,
        state: "playable",
        stage: "finalizing",
        encodeProgress: 38,
        url: PLAYLIST,
        thumbnailUrl: "https://cdn.example.net/video-guid/thumbnail.jpg",
        width: 1080,
        height: 1920,
        durationSeconds: 120,
      });
    });

    const stages: string[] = [];
    const media = await runWait(
      resumeVideoProcessing(VIDEO_ID, { fileSize: 2 * 1024 * 1024 * 1024 }, {
        onProcessingStage: (stage) => stages.push(stage),
      }),
    );

    expect(media.url).toBe(PLAYLIST);
    expect(media.width).toBe(1080);
    expect(media.durationSeconds).toBe(120);
    expect(stages).toEqual(["finalizing"]);
  });

  it("keeps polling - and reporting real progress - while Bunny is still encoding", async () => {
    const responses = [
      { ready: false, playable: false, state: "processing", stage: "queued", encodeProgress: 0 },
      { ready: false, playable: false, state: "processing", stage: "encoding", encodeProgress: 12 },
      { ready: false, playable: false, state: "processing", stage: "encoding", encodeProgress: 64 },
      {
        ready: true,
        playable: true,
        state: "ready",
        stage: "finalizing",
        encodeProgress: 100,
        url: PLAYLIST,
        thumbnailUrl: "thumb.jpg",
        width: 720,
        height: 1280,
        durationSeconds: 61,
      },
    ];
    fetchMock.mockImplementation(async () =>
      statusResponse(responses[Math.min(fetchMock.mock.calls.length - 1, responses.length - 1)]),
    );

    const progress: number[] = [];
    const stages: string[] = [];
    const media = await runWait(
      resumeVideoProcessing(VIDEO_ID, { fileSize: 50 * 1024 * 1024 }, {
        onProgress: (fraction) => progress.push(Math.round(fraction * 100)),
        onProcessingStage: (stage) => stages.push(stage),
      }),
    );

    expect(media.url).toBe(PLAYLIST);
    // The bar moves through the processing phase instead of freezing at its 80% floor.
    expect(progress).toEqual([80, 80, 82, 93, 100]);
    expect(stages).toEqual(["queued", "encoding", "finalizing"]);
  });

  it("waits for a full transcode when the partial manifest cannot be reached", async () => {
    const statuses = [
      {
        ready: false,
        playable: true,
        state: "playable",
        stage: "finalizing",
        encodeProgress: 20,
        url: PLAYLIST,
      },
      {
        ready: true,
        playable: true,
        state: "ready",
        stage: "finalizing",
        encodeProgress: 100,
        url: PLAYLIST,
        durationSeconds: 30,
      },
    ];
    let statusCalls = 0;
    fetchMock.mockImplementation(async (input: string) => {
      // The pull zone refuses the cross-origin manifest check.
      if (input === PLAYLIST) throw new TypeError("Failed to fetch");
      const body = statuses[Math.min(statusCalls, statuses.length - 1)];
      statusCalls += 1;
      return statusResponse(body);
    });

    const media = await runWait(resumeVideoProcessing(VIDEO_ID, { fileSize: 10 * 1024 * 1024 }));

    expect(media.url).toBe(PLAYLIST);
    expect(statusCalls).toBeGreaterThan(1);
  });

  it("rides out a failing status route instead of losing the upload", async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      if (calls <= 3) throw new TypeError("Network request failed");
      if (calls === 4) return statusResponse({ error: "temporarily unavailable" }, 502);
      return statusResponse({
        ready: true,
        playable: true,
        state: "ready",
        encodeProgress: 100,
        url: PLAYLIST,
        durationSeconds: 12,
      });
    });

    const media = await runWait(resumeVideoProcessing(VIDEO_ID, { fileSize: 10 * 1024 * 1024 }));
    expect(media.url).toBe(PLAYLIST);
  });

  it("reports a transcode Bunny gave up on, in Bunny's own words", async () => {
    fetchMock.mockResolvedValue(
      statusResponse({ ready: false, playable: false, state: "failed", error: "Unsupported codec" }),
    );

    await expect(runWait(resumeVideoProcessing(VIDEO_ID, { fileSize: 1_000 }))).rejects.toThrow(
      "Unsupported codec",
    );
  });

  it("gives up on a video that stops moving, without calling the upload lost", async () => {
    fetchMock.mockResolvedValue(
      statusResponse({
        ready: false,
        playable: false,
        state: "processing",
        stage: "encoding",
        encodeProgress: 41,
      }),
    );

    const wait = resumeVideoProcessing(VIDEO_ID, { fileSize: 10 * 1024 * 1024 }).catch((error) => error);
    // Far past both the stall timeout and a small file's budget.
    const error = await runWait(wait, 900);

    expect(error).toBeInstanceOf(VideoStillProcessingError);
    expect(isResumableVideoWaitError(error)).toBe(true);
    expect((error as Error).message).toContain("Nothing is lost");
  });

  it("stops when the person stops waiting", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort("abandoned");
      return statusResponse({ ready: false, playable: false, state: "processing", encodeProgress: 3 });
    });

    const wait = resumeVideoProcessing(VIDEO_ID, { fileSize: 1_000 }, {
      signal: controller.signal,
    }).catch((error) => error);

    expect(await runWait(wait)).toBeInstanceOf(VideoProcessingCancelledError);
  });

  it("does not throw away an upload over a sub-second duration disagreement", async () => {
    fetchMock.mockResolvedValue(
      statusResponse({
        ready: true,
        playable: true,
        state: "ready",
        encodeProgress: 100,
        url: PLAYLIST,
        durationSeconds: 902,
      }),
    );

    const media = await runWait(resumeVideoProcessing(VIDEO_ID, { fileSize: 1_000 }));
    expect(media.durationSeconds).toBe(900);
  });

  it("lets a premium post keep an hours-long video the free cap would refuse", async () => {
    fetchMock.mockResolvedValue(
      statusResponse({
        ready: true,
        playable: true,
        state: "ready",
        encodeProgress: 100,
        url: PLAYLIST,
        durationSeconds: 95 * 60,
      }),
    );

    const media = await runWait(
      resumeVideoProcessing(VIDEO_ID, {
        fileSize: 6 * 1024 * 1024 * 1024,
        durationSeconds: 95 * 60,
        maxDurationSeconds: MAX_PREMIUM_VIDEO_DURATION_SECONDS,
      }),
    );

    expect(media.durationSeconds).toBe(95 * 60);
  });

  it("still refuses a video past the ceiling its own post allows", async () => {
    fetchMock.mockResolvedValue(
      statusResponse({
        ready: true,
        playable: true,
        state: "ready",
        encodeProgress: 100,
        url: PLAYLIST,
        durationSeconds: 1_800,
      }),
    );

    await expect(runWait(resumeVideoProcessing(VIDEO_ID, { fileSize: 1_000 }))).rejects.toThrow(
      "15 minutes or shorter",
    );

    await expect(
      runWait(
        resumeVideoProcessing(VIDEO_ID, {
          fileSize: 1_000,
          maxDurationSeconds: MAX_PREMIUM_VIDEO_DURATION_SECONDS,
        }),
      ),
    ).resolves.toBeTruthy();
  });
});
