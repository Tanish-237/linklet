/**
 * Cloudinary delivery helpers.
 *
 * Uploads are stored at their original size (a phone photo is routinely
 * 3-5 MB), so serving the stored URL as-is ships the full original into a
 * 40px avatar or a 600px feed card. Cloudinary can resize and re-encode on the
 * fly by inserting a transformation segment after `/upload/`:
 *
 *   .../image/upload/v123/photo.jpg  ->  .../image/upload/f_auto,q_auto,w_600,c_limit/v123/photo.jpg
 *
 *  - f_auto  : WebP/AVIF for browsers that support it, JPEG otherwise
 *  - q_auto  : perceptual quality tuning
 *  - w_N,c_limit : never wider than N px, never upscaled
 *
 * Any URL that isn't a Cloudinary *image* upload URL (Google avatars, local
 * assets, data: previews, raw/video resources) is returned untouched.
 */
const UPLOAD_MARKER = "/image/upload/";

// A segment like "f_auto,q_auto,w_200" (or "c_fill,w_100/") right after /upload/ means
// the URL already carries transformations — leave those alone.
const HAS_TRANSFORMS = /^(?:[a-z]{1,3}_[^/,]+,?)+\//i;

export const isCloudinaryImage = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com") && url.includes(UPLOAD_MARKER);

export const optimizeImage = (url, { width, height, crop = "limit" } = {}) => {
  if (!isCloudinaryImage(url)) return url;

  const [head, tail] = url.split(UPLOAD_MARKER);
  if (HAS_TRANSFORMS.test(tail)) return url;

  const transforms = ["f_auto", "q_auto"];
  if (width) transforms.push(`w_${Math.round(width)}`);
  if (height) transforms.push(`h_${Math.round(height)}`);
  if (width || height) transforms.push(`c_${crop}`);

  return `${head}${UPLOAD_MARKER}${transforms.join(",")}/${tail}`;
};

/** Avatars: small square, face-aware crop, 2x for high-DPI screens. */
export const optimizeAvatar = (url, size = 48) =>
  optimizeImage(url, { width: size * 2, height: size * 2, crop: "fill" });

/** `srcset` for content images so phones don't download desktop-sized files. */
export const buildSrcSet = (url, widths = [480, 800, 1200]) => {
  if (!isCloudinaryImage(url)) return undefined;
  return widths.map((w) => `${optimizeImage(url, { width: w })} ${w}w`).join(", ");
};

const VIDEO_UPLOAD_MARKER = "/video/upload/";

export const isCloudinaryVideo = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com") && url.includes(VIDEO_UPLOAD_MARKER);

/**
 * A poster-frame JPG for a Cloudinary video — feed cards can then show a
 * real thumbnail image instead of embedding a live <video> element just to
 * display a static preview. Returns undefined for anything that isn't a
 * Cloudinary video URL.
 *
 * Uses Cloudinary's `so_auto` smart frame selection rather than a fixed
 * timestamp like `so_0` (literally the first frame) — a screen-recorded demo
 * or a video with a fade-in routinely opens on a blank/black frame, which
 * made `so_0` thumbnails look like a broken preview instead of an actual
 * preview. `so_auto` analyzes the video and picks a representative frame.
 */
export const getVideoThumbnail = (url) => {
  if (!isCloudinaryVideo(url)) return undefined;
  const [head, tail] = url.split(VIDEO_UPLOAD_MARKER);
  const withoutExt = tail.replace(/\.[a-z0-9]+$/i, "");
  return `${head}${VIDEO_UPLOAD_MARKER}so_auto/${withoutExt}.jpg`;
};
