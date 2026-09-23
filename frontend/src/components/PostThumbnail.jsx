import React, { useState } from "react";
import { getVideoThumbnail } from "../utlis/cloudinary";

// A video post's media URL lives in the same `post.image` field as an image
// post (mediaType is what distinguishes them) — rendering it straight into
// an <img> silently fails since a browser can't decode a video file as an
// image, leaving just the card's overlay gradient with no thumbnail
// underneath. Mirrors the feed card's video-thumbnail handling in Posts.jsx.
const PostThumbnail = ({ post }) => {
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!post.image) {
    return (
      <div className="profile-post-text-placeholder">
        <p>{post.caption}</p>
      </div>
    );
  }

  if (post.mediaType !== "video") {
    return (
      <img
        src={post.image}
        alt={post.caption || "Post"}
        className="profile-post-image"
        loading="lazy"
      />
    );
  }

  const videoThumb = getVideoThumbnail(post.image);

  return (
    <div className="profile-post-video-thumb">
      {videoThumb && !thumbFailed ? (
        <img
          src={videoThumb}
          alt={post.caption || "Post"}
          className="profile-post-image"
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      ) : (
        // Default preview when there's no Cloudinary-derived thumbnail (a
        // non-Cloudinary URL) or it failed to load.
        <div className="profile-post-video-placeholder">
          <span className="material-icons">movie</span>
        </div>
      )}
      <span className="profile-post-play-icon">
        <span className="material-icons">play_arrow</span>
      </span>
    </div>
  );
};

export default PostThumbnail;
