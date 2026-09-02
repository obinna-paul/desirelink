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
export async function sniffMediaKind(file: File): Promise<"image" | "video" | null> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await readFileAsArrayBuffer(file.slice(0, 32)));
  } catch {
    return null;
  }

  const byteMatch = (offset: number, ...values: number[]) =>
    values.every((value, index) => head[offset + index] === value);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...Array.from(head.slice(offset, offset + length)));

  if (byteMatch(0, 0x89, 0x50, 0x4e, 0x47)) return "image"; // PNG
  if (byteMatch(0, 0xff, 0xd8, 0xff)) return "image"; // JPEG
  if (ascii(0, 3) === "GIF") return "image"; // GIF87a / GIF89a
  if (byteMatch(0, 0x42, 0x4d)) return "image"; // BMP
  if (byteMatch(0, 0x49, 0x49, 0x2a, 0x00) || byteMatch(0, 0x4d, 0x4d, 0x00, 0x2a)) return "image"; // TIFF
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image";
  if (ascii(0, 4) === "RIFF" && ascii(8, 3) === "AVI") return "video";
  if (byteMatch(0, 0x1a, 0x45, 0xdf, 0xa3)) return "video"; // WebM/MKV (EBML header)

  // ISO base media container - MP4/MOV/M4V and AVIF/HEIC/HEIF all share this "ftyp" box.
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    const imageBrands = new Set(["avif", "avis", "heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
    return imageBrands.has(brand) ? "image" : "video";
  }

  return null;
}
