export const MAX_POST_MEDIA_ITEMS = 10;
export const MAX_POST_IMAGES = MAX_POST_MEDIA_ITEMS;

export const POST_MEDIA_TYPES = ["image", "video"] as const;
export type PostMediaType = (typeof POST_MEDIA_TYPES)[number];

/**
 * A video isn't re-encoded on upload, so it can't be pixel-cropped like an image is.
 * Instead the composer's frame/adjust step records where the creator chose to pan and
 * zoom within the post's chosen aspect ratio, as fractions of the frame - resolution
 * independent, so the feed player can reproduce the exact same crop at any width.
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
  crop?: VideoCrop;
};

/** Legacy fallback: feed media renders at its own aspect ratio (post-crop for images, native for video), clamped to Reels-style bounds. */
export const MIN_MEDIA_ASPECT_RATIO = 9 / 16; // tallest allowed: full-screen portrait
export const MAX_MEDIA_ASPECT_RATIO = 16 / 9; // widest allowed: landscape
const DEFAULT_MEDIA_ASPECT_RATIO = 4 / 5; // used only when a media item is missing dimensions (e.g. local-upload fallback)

export function feedMediaAspectRatio(item: Pick<PostMediaItem, "width" | "height">): number {
  const raw = item.width && item.height ? item.width / item.height : DEFAULT_MEDIA_ASPECT_RATIO;
  return Math.min(MAX_MEDIA_ASPECT_RATIO, Math.max(MIN_MEDIA_ASPECT_RATIO, raw));
}

/** The three post-level dimensions a creator picks up front; every photo and video in the post is framed to this same ratio. */
export const POST_ASPECT_RATIOS = [
  { id: "square", label: "Square", ratio: 1 },
  { id: "portrait", label: "3:4", ratio: 3 / 4 },
  { id: "full", label: "Full length", ratio: 9 / 16 },
] as const satisfies readonly { id: string; label: string; ratio: number }[];
export type PostAspectRatioId = (typeof POST_ASPECT_RATIOS)[number]["id"];

export function postAspectRatioValue(id: PostAspectRatioId): number {
  return POST_ASPECT_RATIOS.find((option) => option.id === id)?.ratio ?? POST_ASPECT_RATIOS[0].ratio;
}
