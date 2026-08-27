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
