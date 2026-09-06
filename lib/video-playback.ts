export function isHlsVideoSource(src: string): boolean {
  return /\.m3u8(?:$|[?#])/i.test(src);
}

/** Bunny Stream keeps the generated poster beside its HLS manifest. A poster gives
 * mobile browsers a stable visual while the manifest and first media segment load. */
export function getVideoPosterUrl(src: string): string | undefined {
  if (!isHlsVideoSource(src)) return undefined;

  try {
    const url = new URL(src);
    url.pathname = url.pathname.replace(/\/playlist\.m3u8$/i, "/thumbnail.jpg");
    return url.toString();
  } catch {
    return src.replace(/\/playlist\.m3u8(?=($|[?#]))/i, "/thumbnail.jpg");
  }
}

export type VideoTapZone = "backward" | "center" | "forward";

export function getVideoTapZone(
  clientX: number,
  frame: Pick<DOMRect, "left" | "width">,
): VideoTapZone {
  if (frame.width <= 0) return "center";
  const position = (clientX - frame.left) / frame.width;
  if (position <= 0.3) return "backward";
  if (position >= 0.7) return "forward";
  return "center";
}
