import { vi, describe, it, expect, beforeEach } from "vitest";
import axios from "axios";
import { apiClient } from "../apiClient";
import { uploadToCloudinary } from "../directUpload";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../apiClient", () => ({ apiClient: { post: vi.fn() } }));

const signed = {
  uploadUrl: "https://api.cloudinary.com/v1_1/demo/auto/upload",
  apiKey: "key",
  timestamp: 1732200000,
  folder: "linklet/chat",
  signature: "sig",
};

describe("uploadToCloudinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.post.mockResolvedValue({ data: { success: true, data: signed } });
  });

  it("signs, uploads to Cloudinary and returns what the API needs to verify", async () => {
    axios.post.mockResolvedValue({
      data: {
        public_id: "linklet/chat/abc",
        version: 1,
        signature: "resp-sig",
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/linklet/chat/abc.png",
        resource_type: "image",
        format: "png",
        bytes: 10,
        api_key: "key",
      },
    });
    const file = new File(["x"], "a.png", { type: "image/png" });

    const result = await uploadToCloudinary(file, "chat");

    expect(apiClient.post).toHaveBeenCalledWith("/uploads/sign", { purpose: "chat" });
    const [url, form] = axios.post.mock.calls[0];
    expect(url).toBe(signed.uploadUrl);
    expect(form.get("file")).toBe(file);
    expect(form.get("signature")).toBe("sig");
    expect(form.get("folder")).toBe("linklet/chat");
    expect(form.get("timestamp")).toBe("1732200000");
    expect(result).toEqual({
      public_id: "linklet/chat/abc",
      version: 1,
      signature: "resp-sig",
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/linklet/chat/abc.png",
      resource_type: "image",
      format: "png",
      bytes: 10,
      original_name: "a.png",
      mimetype: "image/png",
    });
  });

  it("turns a Cloudinary rejection into an API-shaped error message", async () => {
    axios.post.mockRejectedValue({ response: { data: { error: { message: "File size too large" } } } });
    await expect(uploadToCloudinary(new File(["x"], "big.mp4"), "post")).rejects.toMatchObject({
      response: { data: { message: "Upload failed: File size too large" } },
    });
  });
});
