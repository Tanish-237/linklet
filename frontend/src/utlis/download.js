import { isSafeHttpUrl, safeOpenUrl } from "./safeUrl";

/**
 * Downloads that work on phones.
 *
 * Mobile browsers (iOS Safari above all) only let a tap open or save a file
 * while the tap itself is being handled. A download started after an `await`
 * (an API call, a fetch-to-blob) is silently dropped, and a blob URL revoked
 * right after `click()` can cancel the save before it starts.
 *
 * Cloudinary serves `fl_attachment` URLs with `Content-Disposition:
 * attachment`, so pointing the current tab at one saves the file without
 * leaving the page — synchronously, no blob, no new tab. `fl_attachment:<name>`
 * also sets the saved filename (Cloudinary appends the extension).
 */

const UPLOAD = "/upload/";

const isCloudinaryUpload = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com") && url.includes(UPLOAD);

// Flag values only allow a plain name: no dots, slashes, commas or spaces.
const toAttachmentName = (name) =>
  String(name || "")
    .replace(/\.[a-z0-9]{1,6}$/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

export const toDownloadUrl = (url, name) => {
  if (!isCloudinaryUpload(url)) return url;
  const [head, ...rest] = url.split(UPLOAD);
  const tail = rest.join(UPLOAD).replace(/^fl_attachment(:[^/,]*)?\//, "");
  const safeName = toAttachmentName(name);
  return `${head}${UPLOAD}fl_attachment${safeName ? `:${safeName}` : ""}/${tail}`;
};

/**
 * Save `url` as a file. Call it directly from the click/tap handler — not
 * after an await. Anything that isn't a Cloudinary upload opens in a new tab.
 */
export const downloadFile = (url, name) => {
  if (!isSafeHttpUrl(url)) return false;
  if (!isCloudinaryUpload(url)) return safeOpenUrl(url);

  const link = document.createElement("a");
  link.href = toDownloadUrl(url, name);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
};
