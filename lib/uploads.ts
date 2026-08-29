import "server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

import { cloudinary } from "@/lib/cloudinary";

export type UploadResourceType = "image" | "video";

export type StoredUpload = {
  url: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

type StoreUploadOptions = {
  buffer: Buffer;
  /** Cloudinary folder, e.g. "udala/avatars". Also used to namespace the local fallback path. */
  folder: string;
  /** Stable id for overwrite semantics (avatars reuse the profile id). Random when omitted. */
  publicId?: string;
  /** Original file's MIME type, used to pick an extension for the local fallback. */
  contentType: string;
  resourceType?: UploadResourceType;
  /** Cloudinary transformation array (ignored by the local fallback, which stores the original). */
  transformation?: Record<string, unknown>[];
};

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extensionFor(contentType: string, resourceType: UploadResourceType): string {
  return EXTENSION_BY_TYPE[contentType] ?? (resourceType === "video" ? "mp4" : "jpg");
}

async function uploadToCloudinary(options: StoreUploadOptions): Promise<StoredUpload> {
  const result = await new Promise<{ secure_url: string; width?: number; height?: number; duration?: number }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          overwrite: Boolean(options.publicId),
          resource_type: options.resourceType === "video" ? "video" : "image",
          transformation: options.transformation,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result);
        }
      );
      uploadStream.end(options.buffer);
    }
  );

  return { url: result.secure_url, width: result.width, height: result.height, durationSeconds: result.duration };
}

/**
 * Local dev/self-hosted fallback used when Cloudinary isn't configured — the
 * uploads analog of USE_MOCK_PAYMENTS. Writes the file under public/uploads/
 * and returns a normal path that works with next/image and plain <img>.
 * (On read-only/serverless hosting configure Cloudinary instead; writes there
 * will throw and surface as a normal upload error.)
 */
async function storeLocally(options: StoreUploadOptions): Promise<StoredUpload> {
  const resourceType = options.resourceType ?? "image";
  const ext = extensionFor(options.contentType, resourceType);
  const folderSegment = options.folder.replace(/^udala\//, "").replace(/[^a-z0-9/_-]/gi, "_");
  const fileName = `${options.publicId ?? randomBytes(12).toString("hex")}.${ext}`;
  const relativeDir = path.join("uploads", folderSegment);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), options.buffer);

  return { url: `/${relativeDir}/${fileName}`.replace(/\\/g, "/") };
}

export async function storeUpload(options: StoreUploadOptions): Promise<StoredUpload> {
  return isCloudinaryConfigured() ? uploadToCloudinary(options) : storeLocally(options);
}
