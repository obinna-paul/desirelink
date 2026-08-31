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
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type);
}

export function isAllowedVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.has(file.type);
}

export function isAllowedPostMediaFile(file: File): boolean {
  return isAllowedImageFile(file) || isAllowedVideoFile(file);
}

export function allowedImageTypesLabel(): string {
  return "JPEG, PNG, WebP, GIF, AVIF, HEIC, or HEIF";
}

export function allowedPostMediaTypesLabel(): string {
  return "JPEG, PNG, WebP, GIF, MP4, WebM, or MOV";
}
