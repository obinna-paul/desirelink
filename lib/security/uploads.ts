import "server-only";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
]);

export function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type);
}

export function isAllowedVideoFile(file: File): boolean {
  return isAllowedVideoContentType(file.type);
}

/** Same allowlist as isAllowedVideoFile, but for server routes that only ever see a
 * content-type string (e.g. a presigned-upload request) and never an actual File. */
export function isAllowedVideoContentType(contentType: string): boolean {
  return ALLOWED_VIDEO_TYPES.has(contentType);
}

export function isAllowedPostMediaFile(file: File): boolean {
  return isAllowedImageFile(file) || isAllowedVideoFile(file);
}

export function isAllowedAudioFile(file: File): boolean {
  return ALLOWED_AUDIO_TYPES.has(file.type);
}

export function allowedImageTypesLabel(): string {
  return "JPEG, PNG, WebP, GIF, AVIF, HEIC, or HEIF";
}

export function allowedVideoTypesLabel(): string {
  return "MP4, WebM, or MOV";
}

export function allowedPostMediaTypesLabel(): string {
  return "JPEG, PNG, WebP, GIF, MP4, WebM, or MOV";
}
