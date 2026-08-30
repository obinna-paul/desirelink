export const MAX_POST_MEDIA_ITEMS = 10;
export const MAX_POST_IMAGES = MAX_POST_MEDIA_ITEMS;

export const POST_MEDIA_TYPES = ["image", "video"] as const;
export type PostMediaType = (typeof POST_MEDIA_TYPES)[number];

export type PostMediaItem = {
  url: string;
  type: PostMediaType;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

/** Feed media renders at its own aspect ratio (post-crop for images, native for video), clamped to Reels-style bounds. */
export const MIN_MEDIA_ASPECT_RATIO = 9 / 16; // tallest allowed: full-screen portrait
export const MAX_MEDIA_ASPECT_RATIO = 16 / 9; // widest allowed: landscape
const DEFAULT_MEDIA_ASPECT_RATIO = 4 / 5; // used only when a media item is missing dimensions (e.g. local-upload fallback)

export function feedMediaAspectRatio(item: Pick<PostMediaItem, "width" | "height">): number {
  const raw = item.width && item.height ? item.width / item.height : DEFAULT_MEDIA_ASPECT_RATIO;
  return Math.min(MAX_MEDIA_ASPECT_RATIO, Math.max(MIN_MEDIA_ASPECT_RATIO, raw));
}

export const IMAGE_CROP_PRESETS = [
  { id: "original", label: "Original", ratio: null },
  { id: "square", label: "Square", ratio: 1 },
  { id: "portrait", label: "Portrait", ratio: 4 / 5 },
  { id: "tall", label: "3:4", ratio: 3 / 4 },
] as const satisfies readonly { id: string; label: string; ratio: number | null }[];
export type ImageCropPresetId = (typeof IMAGE_CROP_PRESETS)[number]["id"];
