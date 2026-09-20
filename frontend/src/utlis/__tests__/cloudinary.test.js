import { describe, it, expect } from "vitest";
import { optimizeImage, optimizeAvatar, buildSrcSet, isCloudinaryImage } from "../cloudinary";

const CLD = "https://res.cloudinary.com/demo/image/upload/v1712345678/posts/photo.jpg";

describe("cloudinary helpers", () => {
  it("adds f_auto,q_auto and a width cap to a Cloudinary image URL", () => {
    const out = optimizeImage(CLD, { width: 600 });
    console.log("TRACE [cloudinary.test]: optimizeImage ->", out);
    expect(out).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_600,c_limit/v1712345678/posts/photo.jpg"
    );
  });

  it("with no size still enables automatic format + quality", () => {
    expect(optimizeImage(CLD)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1712345678/posts/photo.jpg"
    );
  });

  it("uses a face-friendly fill crop at 2x for avatars", () => {
    const out = optimizeAvatar(CLD, 40);
    console.log("TRACE [cloudinary.test]: optimizeAvatar ->", out);
    expect(out).toContain("w_80,h_80,c_fill");
  });

  it("never touches URLs that are not Cloudinary images", () => {
    const google = "https://lh3.googleusercontent.com/a/abc=s96-c";
    const raw = "https://res.cloudinary.com/demo/raw/upload/v1/notes.pdf";
    const video = "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4";
    expect(optimizeImage(google, { width: 100 })).toBe(google);
    expect(optimizeImage(raw, { width: 100 })).toBe(raw);
    expect(optimizeImage(video, { width: 100 })).toBe(video);
    expect(optimizeImage("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(optimizeImage(undefined)).toBeUndefined();
    expect(optimizeImage("")).toBe("");
  });

  it("leaves a URL that already has transformations alone (no double-transform)", () => {
    const already = "https://res.cloudinary.com/demo/image/upload/c_fill,w_100/v1/a.jpg";
    expect(optimizeImage(already, { width: 600 })).toBe(already);
  });

  it("builds a srcset with one candidate per width, or undefined for non-Cloudinary URLs", () => {
    const set = buildSrcSet(CLD, [480, 800]);
    console.log("TRACE [cloudinary.test]: srcset ->", set);
    expect(set).toContain("w_480,c_limit/v1712345678/posts/photo.jpg 480w");
    expect(set).toContain("w_800,c_limit/v1712345678/posts/photo.jpg 800w");
    expect(buildSrcSet("https://example.com/a.png")).toBeUndefined();
  });

  it("isCloudinaryImage only accepts image upload URLs", () => {
    expect(isCloudinaryImage(CLD)).toBe(true);
    expect(isCloudinaryImage("https://example.com/image/upload/x.jpg")).toBe(false);
    expect(isCloudinaryImage(null)).toBe(false);
  });
});
