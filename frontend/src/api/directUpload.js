import axios from 'axios';
import { apiClient } from './apiClient.js';

/**
 * Upload a file from the browser straight to Cloudinary.
 *
 * Files never pass through the API: its host (Vercel) rejects request bodies
 * over 4.5 MB. The API signs the upload (POST /uploads/sign), the browser sends
 * the file to Cloudinary, and the result goes back to the API in the request
 * that uses it, e.g. `{ imageUpload: result }`. The API verifies the result's
 * signature before accepting it (backend directUpload.middleware.js).
 *
 * `purpose` is one of: post, avatar, chat, group, resource.
 * Errors are shaped like API errors (`err.response.data.message`), so existing
 * `toast.error(err.response?.data?.message || ...)` handlers show them as-is.
 */
export const uploadToCloudinary = async (file, purpose, { onProgress } = {}) => {
  const { data } = await apiClient.post('/uploads/sign', { purpose });
  const { uploadUrl, apiKey, timestamp, folder, signature } = data.data;

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  let result;
  try {
    // Plain axios: Cloudinary is a different origin and needs no cookies.
    const res = await axios.post(uploadUrl, form, {
      onUploadProgress: onProgress
        ? (e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100))
        : undefined,
    });
    result = res.data;
  } catch (err) {
    const reason = err.response?.data?.error?.message;
    const wrapped = new Error(reason || 'Upload failed');
    wrapped.response = {
      data: { message: reason ? `Upload failed: ${reason}` : 'Upload failed. Check your connection and try again.' },
    };
    throw wrapped;
  }

  return {
    public_id: result.public_id,
    version: result.version,
    signature: result.signature,
    secure_url: result.secure_url,
    resource_type: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    original_name: file.name,
    mimetype: file.type,
  };
};
