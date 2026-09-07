import { convertHeicFileToJpeg, isHeicFile } from "@/lib/heic-convert";
import {
  inferMediaTypeFromFileName,
  readFileAsArrayBuffer,
  sniffMediaType,
  withNormalizedMediaType,
} from "@/lib/media-sniff";

export const MAX_EDITABLE_IMAGE_BYTES = 30 * 1024 * 1024;

const MAX_EDITABLE_IMAGE_DIMENSION = 2400;
const MAX_EDITABLE_IMAGE_OUTPUT_BYTES = 4.5 * 1024 * 1024;
const FIRST_PARTY_NORMALIZE_MAX_BYTES = 3.5 * 1024 * 1024;
const EDITABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
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

type ProfileImageUploadSignature = {
  apiKey: string;
  cloudName: string;
  folder: string;
  timestamp: number;
  signature: string;
  transformation: string;
  format: string;
};

function uploadForRemoteNormalization(file: File, sign: ProfileImageUploadSignature) {
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sign.apiKey);
    formData.append("timestamp", String(sign.timestamp));
    formData.append("signature", sign.signature);
    formData.append("folder", sign.folder);
    formData.append("transformation", sign.transformation);
    formData.append("format", sign.format);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`);
    xhr.timeout = 120_000;
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText || "null") as {
            secure_url?: string;
            public_id?: string;
          } | null;
        } catch {
          return null;
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url && body.public_id) {
        resolve({ url: body.secure_url, publicId: body.public_id });
        return;
      }
      reject(new Error("Remote photo conversion failed"));
    };
    xhr.onerror = () => reject(new Error("Remote photo conversion could not be reached"));
    xhr.ontimeout = () => reject(new Error("Remote photo conversion timed out"));
    xhr.send(formData);
  });
}

async function normalizeImageRemotely(file: File): Promise<File> {
  let uploaded: { url: string; publicId: string } | null = null;

  if (file.size <= FIRST_PARTY_NORMALIZE_MAX_BYTES) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/profile-preview", {
        method: "POST",
        body: formData,
      });
      if (response.ok) uploaded = (await response.json()) as { url: string; publicId: string };
    } catch {
      // A signed direct upload below is the fallback when the application route is blocked.
    }
  }

  if (!uploaded) {
    const signResponse = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "profile-image-normalize" }),
    });
    if (!signResponse.ok) throw new Error("Remote photo conversion is unavailable");

    const sign = (await signResponse.json()) as ProfileImageUploadSignature;
    uploaded = await uploadForRemoteNormalization(file, sign);
  }

  try {
    const normalizedResponse = await fetch(uploaded.url, { cache: "no-store" });
    if (!normalizedResponse.ok) throw new Error("Normalized photo could not be downloaded");
    const normalizedBlob = await normalizedResponse.blob();
    if (!normalizedBlob.size) throw new Error("Normalized photo was empty");
    return new File([normalizedBlob], outputFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } finally {
    void fetch("/api/upload/profile-preview", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId: uploaded.publicId }),
    }).catch(() => undefined);
  }
}

async function decodeWithImageElement(file: File) {
  const url = URL.createObjectURL(file);
  const image = new window.Image();

  try {
    if (typeof image.decode === "function") {
      image.src = url;
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Photo decode failed"));
        image.src = url;
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
      "This image format is not supported. Choose a JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF, BMP, or TIFF photo.",
    );
  }

  let source = withNormalizedMediaType(file, detectedType);
  if (isHeicFile(source) || detectedType === "image/heic" || detectedType === "image/heif") {
    try {
      source = await convertHeicFileToJpeg(source);
    } catch {
      // Cloudinary is the second decoder below when this browser cannot convert HEIC.
    }
  }

  async function decodeSource(candidate: File) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(candidate, { imageOrientation: "from-image" });
        return {
          drawable: bitmap as CanvasImageSource,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      } catch {
        // Some downloaded photos only decode through a fully materialized image element.
      }
    }

    const decoded = await decodeWithImageElement(candidate);
    return {
      drawable: decoded.drawable,
      width: decoded.width,
      height: decoded.height,
      cleanup: () => URL.revokeObjectURL(decoded.url),
    };
  }

  let decoded: Awaited<ReturnType<typeof decodeSource>>;
  try {
    decoded = await decodeSource(source);
  } catch {
    try {
      const bytes = await readFileAsArrayBuffer(source);
      source = new File([bytes], source.name, {
        type: source.type,
        lastModified: source.lastModified,
      });
      decoded = await decodeSource(source);
    } catch {
      try {
        return await normalizeImageRemotely(source);
      } catch {
        throw new EditableImageError(
          "This photo could not be prepared. Check your connection and choose it again.",
        );
      }
    }
  }

  try {
    const scale = Math.min(1, MAX_EDITABLE_IMAGE_DIMENSION / Math.max(decoded.width, decoded.height));
    const outputWidth = Math.max(1, Math.round(decoded.width * scale));
    const outputHeight = Math.max(1, Math.round(decoded.height * scale));
    let canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new EditableImageError("Your browser could not prepare this photo.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(decoded.drawable, 0, 0, outputWidth, outputHeight);

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
    decoded.cleanup();
  }
}
