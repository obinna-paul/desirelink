/**
 * Reads a Blob/File into an ArrayBuffer. Prefers the standard `arrayBuffer()` method, but
 * falls back to `FileReader` for any environment (older WebView, some in-app browsers) where
 * it's missing or throws - a file-reading hiccup should never be the reason an upload fails.
 */
export async function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    try {
      return await blob.arrayBuffer();
    } catch {
      // fall through to FileReader
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Sniffs a file's actual media kind from its magic bytes. Some Android file pickers, cloud
 * download managers, and browser/OS combinations hand us a `File` with an empty or generic
 * `type` (especially for newer formats like AVIF/WEBP/HEIC) - reading the real header means
 * format support isn't at the mercy of MIME-type reporting we don't control.
 */
export async function sniffMediaType(file: File): Promise<string | null> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await readFileAsArrayBuffer(file.slice(0, 512)));
  } catch {
    return null;
  }

  const byteMatch = (offset: number, ...values: number[]) =>
    values.every((value, index) => head[offset + index] === value);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...Array.from(head.slice(offset, offset + length)));

  if (byteMatch(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (byteMatch(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (byteMatch(0, 0x42, 0x4d)) return "image/bmp";
  if (byteMatch(0, 0x49, 0x49, 0x2a, 0x00) || byteMatch(0, 0x4d, 0x4d, 0x00, 0x2a)) return "image/tiff";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "RIFF" && ascii(8, 3) === "AVI") return "video/x-msvideo";
  if (ascii(0, 3) === "FLV") return "video/x-flv";
  if (
    byteMatch(
      0,
      0x30,
      0x26,
      0xb2,
      0x75,
      0x8e,
      0x66,
      0xcf,
      0x11,
      0xa6,
      0xd9,
      0x00,
      0xaa,
      0x00,
      0x62,
      0xce,
      0x6c,
    )
  ) {
    return "video/x-ms-wmv";
  }
  if (byteMatch(0, 0x00, 0x00, 0x01, 0xba) || byteMatch(0, 0x00, 0x00, 0x01, 0xb3)) {
    return "video/mpeg";
  }
  if (head.length > 188 && head[0] === 0x47 && head[188] === 0x47) return "video/mp2t";
  if (byteMatch(0, 0x1a, 0x45, 0xdf, 0xa3)) {
    const headerText = ascii(0, Math.min(head.length, 32)).toLowerCase();
    return headerText.includes("webm") ? "video/webm" : "video/x-matroska";
  }

  // ISO base media container - MP4/MOV/M4V and AVIF/HEIC/HEIF all share this "ftyp" box.
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
    if (heicBrands.has(brand)) return "image/heic";
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }

  return null;
}

export async function sniffMediaKind(file: File): Promise<"image" | "video" | null> {
  const type = await sniffMediaType(file);
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("video/")) return "video";
  return null;
}

/** Keeps the original bytes, filename, and modified time while replacing an unusable MIME
 * value from the picker. Downstream upload SDKs use `File.type`, so merely sniffing the
 * kind without normalizing the File can still route a real video through the image path. */
export function withNormalizedMediaType(file: File, mediaType: string): File {
  if (file.type === mediaType) return file;
  return new File([file], file.name, {
    type: mediaType,
    lastModified: file.lastModified,
  });
}

const MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  ts: "video/mp2t",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
};

/** A last-resort hint for mobile gallery providers that expose a cloud placeholder before
 * its header bytes are readable. Provider-side decoding still validates the actual file. */
export function inferMediaTypeFromFileName(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? MEDIA_TYPES_BY_EXTENSION[extension] ?? null : null;
}
