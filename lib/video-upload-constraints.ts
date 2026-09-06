export const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 15 * 60;

export type BunnyUploadTransport = "direct" | "relay";

const VIDEO_TYPES_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  webm: "video/webm",
  avi: "video/x-msvideo",
  vod: "video/mpeg",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  ts: "video/mp2t",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  amv: "video/x-amv",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
};

export const VIDEO_UPLOAD_ACCEPT = [
  "video/*",
  ...Object.keys(VIDEO_TYPES_BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

export function inferVideoContentType(fileName: string, suppliedType?: string | null) {
  const normalizedType = suppliedType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalizedType?.startsWith("video/")) return normalizedType;

  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? VIDEO_TYPES_BY_EXTENSION[extension] ?? null : null;
}

export function isMobileChromeBrowser(userAgent: string) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const isChrome = /(?:Chrome|CriOS)\/[\d.]+/i.test(userAgent);
  const isAnotherChromiumBrowser =
    /EdgA|EdgiOS|OPR|OPiOS|Opera Mini|SamsungBrowser|YaBrowser|DuckDuckGo/i.test(
      userAgent,
    );

  return isMobile && isChrome && !isAnotherChromiumBrowser;
}

/**
 * Mobile Chrome talks directly to Bunny. Other mobile browsers keep the same-origin relay
 * that is already proven on those browsers. Either path may switch once if its opening TUS
 * handshake cannot transfer a byte.
 */
export function getBunnyUploadTransportOrder(
  userAgent: string,
  isLikelyMobile: boolean,
): BunnyUploadTransport[] {
  if (isMobileChromeBrowser(userAgent)) return ["direct", "relay"];
  if (isLikelyMobile) return ["relay", "direct"];
  return ["direct", "relay"];
}
