import React, { useState } from "react";
import { getVideoThumbnail } from "../utlis/cloudinary";
import "./PostThumbnail.css";

// A video post's media URL lives in the same `post.image` field as an image
// post (mediaType is what distinguishes them) — rendering it straight into
// an <img> silently fails since a browser can't decode a video file as an
// image, leaving just the card's overlay gradient with no thumbnail
// underneath. Mirrors the feed card's video-thumbnail handling in Posts.jsx.
const PostThumbnail = ({ post }) => {
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!post.image) {
    return (
      <div className="pt-text">
        <p>{post.caption}</p>
      </div>
    );
  }

  if (post.mediaType !== "video") {
    return <img src={post.image} alt={post.caption || "Post"} className="pt-image" loading="lazy" />;
  }

  const videoThumb = getVideoThumbnail(post.image);

  return (
    <div className="pt-video">
      {videoThumb && !thumbFailed ? (
        <img
          src={videoThumb}
          alt={post.caption || "Post"}
          className="pt-image"
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      ) : (
        // Default preview when there's no Cloudinary-derived thumbnail (a
        // non-Cloudinary URL) or it failed to load.
        <div className="pt-video-placeholder">
          <span className="material-icons">movie</span>
        </div>
      )}
      <span className="pt-video-badge">
        <span className="material-icons icon-filled">play_arrow</span>
        Video
      </span>
    </div>
  );
};

export default PostThumbnail;
