import {
  BUNNY_VIDEO_STATUS,
  interpretBunnyVideoStatus,
} from "@/lib/bunny-video-status";

describe("bunny video status", () => {
  it("treats a finished transcode as ready and playable", () => {
    const status = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.finished,
      encodeProgress: 100,
      width: 1080,
      height: 1920,
      length: 42,
      availableResolutions: "240p,360p,720p,1080p",
    });

    expect(status.state).toBe("ready");
    expect(status.ready).toBe(true);
    expect(status.playable).toBe(true);
    expect(status.availableResolutions).toHaveLength(4);
    expect(status.durationSeconds).toBe(42);
  });

  it("lets a partially transcoded video play instead of waiting for every rendition", () => {
    const status = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.transcoding,
      encodeProgress: 35,
      availableResolutions: "360p",
    });

    expect(status.playable).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.state).toBe("playable");
    expect(status.stage).toBe("finalizing");
  });

  it("does not call a video playable before any rendition exists", () => {
    const status = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.transcoding,
      encodeProgress: 4,
      availableResolutions: "",
    });

    expect(status.playable).toBe(false);
    expect(status.state).toBe("processing");
    expect(status.stage).toBe("encoding");
  });

  it("finishes a just-in-time library, which never reports status 4", () => {
    // A JIT library settles on JitPlaylistsCreated. Waiting for Finished there is what
    // left the composer on "Processing video..." forever.
    const jitReady = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.jitPlaylistsCreated,
      encodeProgress: 0,
    });
    expect(jitReady.ready).toBe(true);
    expect(jitReady.state).toBe("ready");

    const jitSegmenting = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.jitSegmenting,
      encodeProgress: 0,
      availableResolutions: "720p",
    });
    expect(jitSegmenting.playable).toBe(true);
  });

  it("accepts encodeProgress alone as finished, and clamps nonsense values", () => {
    expect(interpretBunnyVideoStatus({ status: 3, encodeProgress: 100 }).ready).toBe(true);
    expect(interpretBunnyVideoStatus({ encodeProgress: 160 }).encodeProgress).toBe(100);
    expect(interpretBunnyVideoStatus({ encodeProgress: -5 }).encodeProgress).toBe(0);
  });

  it("reports queued while Bunny has the file but has not started encoding", () => {
    for (const status of [
      BUNNY_VIDEO_STATUS.created,
      BUNNY_VIDEO_STATUS.uploaded,
      BUNNY_VIDEO_STATUS.processing,
    ]) {
      const result = interpretBunnyVideoStatus({ status, encodeProgress: 0 });
      expect(result.stage).toBe("queued");
      expect(result.state).toBe("processing");
    }
  });

  it("surfaces a failure with Bunny's own message when it has one", () => {
    const failed = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.error,
      errorMessage: "Unsupported codec",
    });
    expect(failed.state).toBe("failed");
    expect(failed.playable).toBe(false);
    expect(failed.error).toBe("Unsupported codec");

    const uploadFailed = interpretBunnyVideoStatus({
      status: BUNNY_VIDEO_STATUS.uploadFailed,
      availableResolutions: "360p",
    });
    expect(uploadFailed.state).toBe("failed");
    // A failed upload is never playable, whatever else the record still carries.
    expect(uploadFailed.playable).toBe(false);
    expect(uploadFailed.error).toContain("retry the upload");
  });

  it("drops zero and missing metadata rather than reporting it as measured", () => {
    const status = interpretBunnyVideoStatus({ status: 2, width: 0, height: 0, length: 0 });
    expect(status.width).toBeNull();
    expect(status.height).toBeNull();
    expect(status.durationSeconds).toBeNull();
  });
});
