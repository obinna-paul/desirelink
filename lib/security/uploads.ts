import "server-only";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type);
}

export function allowedImageTypesLabel(): string {
  return "JPEG, PNG, WebP, or GIF";
}
