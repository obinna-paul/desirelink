import { sniffMediaKind } from "@/lib/media-sniff";

function fileFromBytes(bytes: number[], name = "file.bin") {
  return new File([new Uint8Array(bytes)], name, { type: "" });
}

describe("sniffMediaKind", () => {
  it("detects PNG", async () => {
    expect(await sniffMediaKind(fileFromBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image");
  });

  it("detects JPEG", async () => {
    expect(await sniffMediaKind(fileFromBytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image");
  });

  it("detects GIF", async () => {
    expect(await sniffMediaKind(fileFromBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe("image");
  });

  it("detects BMP", async () => {
    expect(await sniffMediaKind(fileFromBytes([0x42, 0x4d, 0, 0, 0, 0]))).toBe("image");
  });

  it("detects WEBP", async () => {
    const bytes = Array(20).fill(0);
    "RIFF".split("").forEach((c, i) => (bytes[i] = c.charCodeAt(0)));
    "WEBP".split("").forEach((c, i) => (bytes[8 + i] = c.charCodeAt(0)));
    expect(await sniffMediaKind(fileFromBytes(bytes))).toBe("image");
  });

  it("detects AVIF via ftyp box", async () => {
    const bytes = Array(16).fill(0);
    "ftyp".split("").forEach((c, i) => (bytes[4 + i] = c.charCodeAt(0)));
    "avif".split("").forEach((c, i) => (bytes[8 + i] = c.charCodeAt(0)));
    expect(await sniffMediaKind(fileFromBytes(bytes))).toBe("image");
  });

  it("detects HEIC via ftyp box", async () => {
    const bytes = Array(16).fill(0);
    "ftyp".split("").forEach((c, i) => (bytes[4 + i] = c.charCodeAt(0)));
    "heic".split("").forEach((c, i) => (bytes[8 + i] = c.charCodeAt(0)));
    expect(await sniffMediaKind(fileFromBytes(bytes))).toBe("image");
  });

  it("detects MP4 via ftyp box as video", async () => {
    const bytes = Array(16).fill(0);
    "ftyp".split("").forEach((c, i) => (bytes[4 + i] = c.charCodeAt(0)));
    "isom".split("").forEach((c, i) => (bytes[8 + i] = c.charCodeAt(0)));
    expect(await sniffMediaKind(fileFromBytes(bytes))).toBe("video");
  });

  it("detects WebM via EBML header", async () => {
    expect(await sniffMediaKind(fileFromBytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe("video");
  });

  it("returns null for unrecognized bytes", async () => {
    expect(await sniffMediaKind(fileFromBytes([1, 2, 3, 4, 5]))).toBeNull();
  });
});
