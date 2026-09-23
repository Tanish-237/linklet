import React, { useState } from "react";
import { toast } from "sonner";
import { reportPost } from "../api/post.api";

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Inappropriate content",
  "Hate speech",
  "Other",
];

const ReportPostModal = ({ postId, onClose, onReported }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!postId) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await reportPost(postId, reason);
      toast.success("Post reported — thanks for letting us know.");
      onReported?.();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to report post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feed-modal-backdrop" onClick={onClose}>
      <div className="feed-report-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="feed-report-modal__title">Report Post</h2>
        <p className="feed-report-modal__subtitle">Why are you reporting this post?</p>

        <div className="feed-report-modal__reasons">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="feed-report-modal__reason">
              <input
                type="radio"
                name="report-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {r}
            </label>
          ))}
        </div>

        <div className="feed-report-modal__actions">
          <button type="button" onClick={onClose} className="feed-create-modal__cancel-btn">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="feed-report-modal__submit-btn"
          >
            {isSubmitting ? "Reporting..." : "Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPostModal;
