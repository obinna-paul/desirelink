export const MAX_POST_MEDIA_ITEMS = 10;
export const MAX_POST_IMAGES = MAX_POST_MEDIA_ITEMS;

export const POST_MEDIA_TYPES = ["image", "video"] as const;
export type PostMediaType = (typeof POST_MEDIA_TYPES)[number];

/**
 * A video isn't re-encoded on upload, so it can't be pixel-cropped like an image is.
 * Instead the frame/adjust step records where the creator chose to pan and zoom within
 * the post's chosen aspect ratio, as fractions of the frame - resolution independent, so
 * the feed player can reproduce the exact same crop at any width.
 */
export type VideoCrop = {
  zoom: number;
  offsetXFrac: number;
  offsetYFrac: number;
};

export type PostMediaItem = {
  url: string;
  type: PostMediaType;
  width?: number;
  height?: number;
  durationSeconds?: number;
  displayAspectRatio?: PostDisplayAspectRatio;
  crop?: VideoCrop;
};

export const POST_DISPLAY_ASPECT_RATIOS = ["square", "portrait_3_4", "full_9_16"] as const;
export type PostDisplayAspectRatio = (typeof POST_DISPLAY_ASPECT_RATIOS)[number];

export const POST_DISPLAY_RATIO_OPTIONS: {
  value: PostDisplayAspectRatio;
  label: string;
  helper: string;
  ratio: number;
}[] = [
  { value: "square", label: "Square", helper: "1:1", ratio: 1 },
  { value: "portrait_3_4", label: "Portrait", helper: "3:4", ratio: 3 / 4 },
  { value: "full_9_16", label: "Full length", helper: "9:16", ratio: 9 / 16 },
];

/** Feed media renders at its own aspect ratio (post-crop for images, native for video), clamped to Reels-style bounds. */
export const MIN_MEDIA_ASPECT_RATIO = 9 / 16; // tallest allowed: full-screen portrait
export const MAX_MEDIA_ASPECT_RATIO = 16 / 9; // widest allowed: landscape
const DEFAULT_MEDIA_ASPECT_RATIO = 4 / 5; // used only when a media item is missing dimensions (e.g. local-upload fallback)

export function feedMediaAspectRatio(item: Pick<PostMediaItem, "width" | "height" | "displayAspectRatio">): number {
  if (item.displayAspectRatio) {
    return POST_DISPLAY_RATIO_OPTIONS.find((option) => option.value === item.displayAspectRatio)?.ratio ?? DEFAULT_MEDIA_ASPECT_RATIO;
  }
  const raw = item.width && item.height ? item.width / item.height : DEFAULT_MEDIA_ASPECT_RATIO;
  return Math.min(MAX_MEDIA_ASPECT_RATIO, Math.max(MIN_MEDIA_ASPECT_RATIO, raw));
}

export const IMAGE_CROP_PRESETS = [
  { id: "square", label: "Square", ratio: 1 },
  { id: "portrait_3_4", label: "3:4", ratio: 3 / 4 },
  { id: "full_9_16", label: "9:16", ratio: 9 / 16 },
] as const satisfies readonly { id: string; label: string; ratio: number | null }[];
export type ImageCropPresetId = (typeof IMAGE_CROP_PRESETS)[number]["id"];
