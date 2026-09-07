import { convertHeicFileToJpeg, isHeicFile } from "@/lib/heic-convert";
import {
  inferMediaTypeFromFileName,
  sniffMediaType,
  withNormalizedMediaType,
} from "@/lib/media-sniff";

export const MAX_EDITABLE_IMAGE_BYTES = 30 * 1024 * 1024;

const MAX_EDITABLE_IMAGE_DIMENSION = 2400;
const MAX_EDITABLE_IMAGE_OUTPUT_BYTES = 4.5 * 1024 * 1024;
const EDITABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

export class EditableImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditableImageError";
  }
}

function outputFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Photo conversion failed"))),
      "image/jpeg",
      quality,
    );
  });
}

async function decodeWithImageElement(file: File) {
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.src = url;

  try {
    if (typeof image.decode === "function") await image.decode();
    else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Photo decode failed"));
      });
    }

    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Photo has no dimensions");
    return {
      drawable: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      url,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Produces one browser-safe JPEG before profile or banner crop UI opens. */
export async function prepareEditableImage(file: File): Promise<File> {
  if (file.size <= 0) throw new EditableImageError("This photo is empty. Choose it again from your gallery.");
  if (file.size > MAX_EDITABLE_IMAGE_BYTES) {
    throw new EditableImageError("This photo is too large. Choose an image under 30 MB.");
  }

  const detectedType =
    (await sniffMediaType(file).catch(() => null)) ??
    (file.type.startsWith("image/") ? file.type.toLowerCase() : null) ??
    inferMediaTypeFromFileName(file.name);

  if (!detectedType || !EDITABLE_IMAGE_TYPES.has(detectedType)) {
    throw new EditableImageError(
      "This image format is not supported. Choose a JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF, or BMP photo.",
    );
  }

  let source = withNormalizedMediaType(file, detectedType);
  if (isHeicFile(source) || detectedType === "image/heic" || detectedType === "image/heif") {
    try {
      source = await convertHeicFileToJpeg(source);
    } catch {
      throw new EditableImageError("This HEIC photo could not be converted. Download it fully to your phone and try again.");
    }
  }

  let drawable: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
      drawable = bitmap;
      width = bitmap.width;
      height = bitmap.height;
      cleanup = () => bitmap.close();
    } else {
      const decoded = await decodeWithImageElement(source);
      drawable = decoded.drawable;
      width = decoded.width;
      height = decoded.height;
      cleanup = () => URL.revokeObjectURL(decoded.url);
    }
  } catch {
    try {
      const decoded = await decodeWithImageElement(source);
      drawable = decoded.drawable;
      width = decoded.width;
      height = decoded.height;
      cleanup = () => URL.revokeObjectURL(decoded.url);
    } catch {
      throw new EditableImageError("This photo could not be read. Download it fully to your device and choose it again.");
    }
  }

  try {
    const scale = Math.min(1, MAX_EDITABLE_IMAGE_DIMENSION / Math.max(width, height));
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    let canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new EditableImageError("Your browser could not prepare this photo.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(drawable, 0, 0, outputWidth, outputHeight);

    let blob = await canvasToBlob(canvas, 0.92);
    if (blob.size > MAX_EDITABLE_IMAGE_OUTPUT_BYTES) blob = await canvasToBlob(canvas, 0.82);
    if (blob.size > MAX_EDITABLE_IMAGE_OUTPUT_BYTES) blob = await canvasToBlob(canvas, 0.72);

    while (blob.size > MAX_EDITABLE_IMAGE_OUTPUT_BYTES && canvas.width > 800) {
      const smallerCanvas = document.createElement("canvas");
      smallerCanvas.width = Math.max(800, Math.round(canvas.width * 0.8));
      smallerCanvas.height = Math.max(1, Math.round((canvas.height * smallerCanvas.width) / canvas.width));
      const smallerContext = smallerCanvas.getContext("2d");
      if (!smallerContext) throw new EditableImageError("Your browser could not prepare this photo.");
      smallerContext.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
      canvas = smallerCanvas;
      blob = await canvasToBlob(canvas, 0.82);
    }

    return new File([blob], outputFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error) {
    if (error instanceof EditableImageError) throw error;
    throw new EditableImageError("Your browser could not prepare this photo. Choose it again and retry.");
  } finally {
    cleanup();
  }
}
