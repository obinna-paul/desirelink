/**
 * The upload session is what lets someone leave Create while a video is uploading and
 * come back to it finished, instead of starting over.
 */
import type { PostDisplayAspectRatio } from "@/lib/post-shared";

const uploadVideoDirect = jest.fn();
const uploadMediaDirectToCloudinary = jest.fn();

jest.mock("@/lib/client-uploads", () => ({
  uploadVideoDirect: (...args: unknown[]) => uploadVideoDirect(...args),
  uploadMediaDirectToCloudinary: (...args: unknown[]) => uploadMediaDirectToCloudinary(...args),
}));

type SessionModule = typeof import("@/lib/video-upload-session");

const CONTEXT = {
  displayAspectRatio: "square" as PostDisplayAspectRatio,
  maxDurationSeconds: 15 * 60,
};

function videoItem(
  name: string,
  durationSeconds = 30,
  displayAspectRatio?: PostDisplayAspectRatio,
) {
  return {
    pending: {
      file: new File(["x"], name, { type: "video/mp4" }),
      kind: "video" as const,
      metadataDetected: false,
      durationSeconds,
    },
    displayAspectRatio,
    videoMeta: { width: 1080, height: 1920, durationSeconds },
  };
}

/** A promise the test resolves by hand, so an upload can be observed mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("video upload session", () => {
  let session: SessionModule;

  beforeEach(() => {
    jest.resetModules();
    uploadVideoDirect.mockReset();
    uploadMediaDirectToCloudinary.mockReset();
    session = require("@/lib/video-upload-session") as SessionModule;
  });

  it("finishes an upload nobody is watching and holds the result", async () => {
    // The composer unmounts the moment someone taps another tab; the upload must not care.
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });

    session.startUploads([videoItem("clip.mp4")], CONTEXT);
    await flush();

    expect(session.getUploadSessionState().active).toBeNull();
    const finished = session.drainCompletedMedia();
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({
      url: "https://cdn.test/v1/playlist.m3u8",
      type: "video",
      width: 1080,
      height: 1920,
      durationSeconds: 30,
      displayAspectRatio: "square",
    });
  });

  it("hands finished media over exactly once", async () => {
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });

    session.startUploads([videoItem("clip.mp4")], CONTEXT);
    await flush();

    expect(session.drainCompletedMedia()).toHaveLength(1);
    // A second composer mount must not add the same video to the draft again.
    expect(session.drainCompletedMedia()).toHaveLength(0);
  });

  it("keeps the frame chosen during review even when the composer context differs", async () => {
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });

    session.startUploads(
      [videoItem("landscape.mp4", 30, "landscape_16_9")],
      CONTEXT,
    );
    await flush();

    expect(session.drainCompletedMedia()[0]?.displayAspectRatio).toBe(
      "landscape_16_9",
    );
  });

  it("shows a composer that mounts mid-upload what is already in flight", async () => {
    const pending = deferred<{ url: string }>();
    uploadVideoDirect.mockImplementation(
      (_file: File, _fallback: string, handlers: { onProgress?: (f: number) => void }) => {
        handlers.onProgress?.(0.42);
        return pending.promise;
      },
    );

    session.startUploads([videoItem("long.mp4")], CONTEXT);
    await flush();

    // This is what a fresh mount reads when someone navigates back to Create.
    expect(session.getUploadSessionState().active).toMatchObject({
      fileName: "long.mp4",
      progress: 42,
    });

    pending.resolve({ url: "https://cdn.test/v1/playlist.m3u8" });
    await flush();
    expect(session.getUploadSessionState().active).toBeNull();
  });

  it("tells subscribers as progress moves, and stops once they leave", async () => {
    const pending = deferred<{ url: string }>();
    let report: ((fraction: number) => void) | undefined;
    uploadVideoDirect.mockImplementation(
      (_file: File, _fallback: string, handlers: { onProgress?: (f: number) => void }) => {
        report = handlers.onProgress;
        return pending.promise;
      },
    );

    const seen: Array<number | null | undefined> = [];
    const unsubscribe = session.subscribeToUploadSession(() => {
      seen.push(session.getUploadSessionState().active?.progress);
    });

    session.startUploads([videoItem("long.mp4")], CONTEXT);
    await flush();
    report?.(0.5);
    expect(seen).toContain(50);

    unsubscribe();
    const countAfterLeaving = seen.length;
    report?.(0.9);
    expect(seen).toHaveLength(countAfterLeaving);

    // And the upload itself carried on regardless of anyone listening.
    expect(session.getUploadSessionState().active?.progress).toBe(90);
    pending.resolve({ url: "https://cdn.test/v1/playlist.m3u8" });
    await flush();
  });

  it("keeps the rest of a carousel behind a failure, and retries the whole remainder", async () => {
    uploadVideoDirect
      .mockRejectedValueOnce(new Error("The connection dropped."))
      .mockResolvedValue({ url: "https://cdn.test/ok/playlist.m3u8" });

    session.startUploads([videoItem("one.mp4"), videoItem("two.mp4")], CONTEXT);
    await flush();

    const failed = session.getUploadSessionState().failed;
    expect(failed?.item.pending.file.name).toBe("one.mp4");
    expect(failed?.remaining).toHaveLength(1);
    expect(session.getUploadSessionState().error).toBe("The connection dropped.");
    expect(session.getUploadSessionState().active).toBeNull();

    session.retryFailedUpload(CONTEXT);
    await flush();

    expect(session.getUploadSessionState().failed).toBeNull();
    expect(session.drainCompletedMedia()).toHaveLength(2);
  });

  it("drops just the failed item when asked, and carries on with the queue", async () => {
    uploadVideoDirect
      .mockRejectedValueOnce(new Error("That file could not be read."))
      .mockResolvedValue({ url: "https://cdn.test/ok/playlist.m3u8" });

    session.startUploads([videoItem("bad.mp4"), videoItem("good.mp4")], CONTEXT);
    await flush();
    expect(session.getUploadSessionState().failed).not.toBeNull();

    session.skipFailedUpload(CONTEXT);
    await flush();

    const finished = session.drainCompletedMedia();
    expect(finished).toHaveLength(1);
    expect(session.getUploadSessionState().failed).toBeNull();
  });

  it("refuses a video past the ceiling its post allows, without adding it", async () => {
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });

    session.startUploads([videoItem("feature-length.mp4", 90 * 60)], CONTEXT);
    await flush();

    expect(session.getUploadSessionState().error).toContain("15 minutes or shorter");
    expect(session.drainCompletedMedia()).toHaveLength(0);
  });

  it("lets a premium post keep a video the free ceiling would refuse", async () => {
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });

    session.startUploads([videoItem("feature-length.mp4", 90 * 60)], {
      ...CONTEXT,
      maxDurationSeconds: 4 * 60 * 60,
    });
    await flush();

    expect(session.getUploadSessionState().error).toBeNull();
    expect(session.drainCompletedMedia()).toHaveLength(1);
  });

  it("queues a second batch behind one already running rather than dropping it", async () => {
    const first = deferred<{ url: string }>();
    uploadVideoDirect
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({ url: "https://cdn.test/second/playlist.m3u8" });

    session.startUploads([videoItem("first.mp4")], CONTEXT);
    await flush();
    // Handed over while the first is still going.
    session.startUploads([videoItem("second.mp4")], CONTEXT);
    await flush();

    expect(session.getUploadSessionState().active?.fileName).toBe("first.mp4");

    first.resolve({ url: "https://cdn.test/first/playlist.m3u8" });
    await flush();

    expect(session.drainCompletedMedia()).toHaveLength(2);
  });

  it("clears what a published draft was holding", async () => {
    uploadVideoDirect.mockResolvedValue({ url: "https://cdn.test/v1/playlist.m3u8" });
    session.startUploads([videoItem("clip.mp4")], CONTEXT);
    await flush();

    session.resetUploadSession();

    expect(session.drainCompletedMedia()).toHaveLength(0);
    expect(session.getUploadSessionState().failed).toBeNull();
    expect(session.getUploadSessionState().error).toBeNull();
  });
});
