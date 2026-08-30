import { v2 as cloudinary } from "cloudinary";

// Cloudinary can be configured either as three separate vars (CLOUDINARY_CLOUD_NAME/
// API_KEY/API_SECRET) or as the single CLOUDINARY_URL the dashboard hands you by
// default (cloudinary://<api_key>:<api_secret>@<cloud_name>) — support both so
// isCloudinaryConfigured() (lib/uploads.ts) doesn't false-negative on a URL-only setup.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };
