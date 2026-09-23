import React, { useState } from "react";
import { toast } from "sonner";
import { updatePost } from "../api/post.api";

// Only the caption is editable — replacing the attached media would mean
// re-uploading to Cloudinary and cleaning up the old asset, which is a
// separate, larger feature than "let the owner fix a typo in their post".
const MAX_CAPTION_LENGTH = 2200;

const EditPostModal = ({ post, onClose, onSaved }) => {
  const [caption, setCaption] = useState(post?.caption || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!post) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !post.image) {
      toast.error("Please add a caption");
      return;
    }
    try {
      setIsSubmitting(true);
      const updated = await updatePost(post._id, caption.trim());
      toast.success("Post updated");
      onSaved?.(updated);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feed-modal-backdrop" onClick={onClose}>
      <div className="feed-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feed-create-modal__header">
          <h2 className="feed-create-modal__title">Edit Post</h2>
          <button onClick={onClose} className="feed-create-modal__close" aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="feed-create-modal__body">
          <textarea
            value={caption}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CAPTION_LENGTH) setCaption(e.target.value);
            }}
            placeholder="What's on your mind?"
            className="feed-create-modal__textarea"
            rows={5}
            autoFocus
          />
          <div className="feed-create-modal__char-count">
            <span>{caption.length}/{MAX_CAPTION_LENGTH}</span>
          </div>
          {post.image && (
            <div className="feed-create-modal__preview">
              {post.mediaType === "video" ? (
                <video src={post.image} controls />
              ) : (
                <img src={post.image} alt="Attached media" />
              )}
            </div>
          )}
          <div className="feed-create-modal__footer">
            <div />
            <div className="feed-create-modal__actions">
              <button type="button" onClick={onClose} className="feed-create-modal__cancel-btn">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!caption.trim() && !post.image)}
                className="feed-create-modal__submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-icons feed-spin">refresh</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-icons">check</span>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPostModal;
