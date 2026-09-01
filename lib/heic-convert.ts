const HEIC_TYPE_PATTERN = /^image\/hei[cf]/i;
const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;

/** iPhones default to HEIC — most browsers besides Safari can't decode it via `<img>`, so it needs to become a JPEG before it ever reaches the crop dialog. */
export function isHeicFile(file: File): boolean {
  return HEIC_TYPE_PATTERN.test(file.type) || HEIC_EXTENSION_PATTERN.test(file.name);
}

/** Converts a HEIC/HEIF file to a JPEG File in the browser. Throws if the file isn't actually decodable HEIC. */
export async function convertHeicFileToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
