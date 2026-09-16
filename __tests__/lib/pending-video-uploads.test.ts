import {
  clearPendingVideoUpload,
  markPendingVideoResumeAttempt,
  MAX_PENDING_RESUME_ATTEMPTS,
  readPendingVideoUpload,
  savePendingVideoUpload,
} from "@/lib/pending-video-uploads";

const STORAGE_KEY = "udala:pending-video-upload";

describe("pending video uploads", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the video a composer would need to resume", () => {
    savePendingVideoUpload({
      videoId: "abc-123",
      fileName: "sunset.mov",
      fileSize: 4 * 1024 * 1024 * 1024,
      durationSeconds: 95 * 60,
      maxDurationSeconds: 4 * 60 * 60,
      displayAspectRatio: "portrait_3_4",
      crop: { zoom: 1.4, offsetXFrac: 0.1, offsetYFrac: -0.2 },
    });

    const record = readPendingVideoUpload();
    expect(record).toMatchObject({
      videoId: "abc-123",
      fileName: "sunset.mov",
      displayAspectRatio: "portrait_3_4",
      resumeAttempts: 0,
      // A resumed long-form wait has to keep its own pacing and its own ceiling.
      durationSeconds: 95 * 60,
      maxDurationSeconds: 4 * 60 * 60,
    });
    expect(record?.crop).toEqual({ zoom: 1.4, offsetXFrac: 0.1, offsetYFrac: -0.2 });
  });

  it("forgets a record that is older than any transcode could reasonably be", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        videoId: "stale",
        fileName: "old.mp4",
        fileSize: 10,
        startedAt: Date.now() - 25 * 60 * 60 * 1000,
        resumeAttempts: 0,
      }),
    );

    expect(readPendingVideoUpload()).toBeNull();
    // Dropped outright, so it is not re-parsed on every composer mount.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("stops offering a video the composer has already tried to finish too often", () => {
    savePendingVideoUpload({ videoId: "stuck", fileName: "stuck.mp4", fileSize: 1 });

    let record = readPendingVideoUpload();
    for (let attempt = 1; attempt <= MAX_PENDING_RESUME_ATTEMPTS; attempt += 1) {
      expect(record).not.toBeNull();
      record = markPendingVideoResumeAttempt(record!);
      expect(record.resumeAttempts).toBe(attempt);
      record = readPendingVideoUpload();
    }

    expect(record).toBeNull();
  });

  it("ignores a malformed or half-written record instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readPendingVideoUpload()).toBeNull();

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ fileName: "no id.mp4" }));
    expect(readPendingVideoUpload()).toBeNull();

    // An unrecognised aspect ratio or crop is dropped; the video id still resumes.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        videoId: "ok",
        startedAt: Date.now(),
        displayAspectRatio: "hexagon",
        crop: { zoom: "wide" },
      }),
    );
    const record = readPendingVideoUpload();
    expect(record?.videoId).toBe("ok");
    expect(record?.displayAspectRatio).toBeUndefined();
    expect(record?.crop).toBeUndefined();
    expect(record?.fileName).toBe("Your video");
  });

  it("survives storage being unavailable", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() =>
      savePendingVideoUpload({ videoId: "x", fileName: "x.mp4", fileSize: 1 }),
    ).not.toThrow();
    expect(readPendingVideoUpload()).toBeNull();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("clears on request", () => {
    savePendingVideoUpload({ videoId: "done", fileName: "done.mp4", fileSize: 1 });
    clearPendingVideoUpload();
    expect(readPendingVideoUpload()).toBeNull();
  });
});
