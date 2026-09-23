import React from "react";
import { Link } from "react-router-dom";
import PostThumbnail from "./PostThumbnail";
import defaultAvatar from "../assets/default-avatar.webp";
import { optimizeAvatar } from "../utlis/cloudinary";
import "./PostGridCard.css";

const shortDate = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
};

/**
 * A post as a card in a grid (profile posts, saved posts): thumbnail on top,
 * caption and stats always visible underneath — no hover needed, so it reads
 * the same on touch screens.
 *
 * `action` is an optional corner button: { icon, hoverIcon?, label, onClick, danger? }.
 */
export function PostGridCard({ post, onOpen, showAuthor = false, action }) {
  const author = post.userId;
  // A text-only post already shows its caption as the thumbnail.
  const showCaption = Boolean(post.image && post.caption);

  return (
    <article className="pgc-card" onClick={() => onOpen(post)}>
      <div className="pgc-media">
        <PostThumbnail post={post} />
        {action && (
          <button
            type="button"
            className={`pgc-action ${action.danger ? "pgc-action-danger" : ""}`}
            title={action.label}
            aria-label={action.label}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(e, post);
            }}
          >
            <span className={`material-icons ${action.hoverIcon ? "pgc-action-idle" : ""} ${action.filled ? "icon-filled" : ""}`}>
              {action.icon}
            </span>
            {action.hoverIcon && <span className="material-icons pgc-action-hover">{action.hoverIcon}</span>}
          </button>
        )}
      </div>

      <div className="pgc-body">
        {showAuthor && author?.username && (
          <Link to={`/profile/${author.username}`} className="pgc-author" onClick={(e) => e.stopPropagation()}>
            <img
              src={optimizeAvatar(author.avatar, 24) || defaultAvatar}
              alt=""
              className="pgc-avatar"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = defaultAvatar;
              }}
            />
            <span className="pgc-username">{author.username}</span>
          </Link>
        )}
        {showCaption && <p className="pgc-caption">{post.caption}</p>}
        <div className="pgc-stats">
          <span title="Upvotes">
            <span className="material-icons">arrow_upward</span>
            {post.upvotes?.length || 0}
          </span>
          <span title="Comments">
            <span className="material-icons">chat_bubble_outline</span>
            {post.commentsCount || 0}
          </span>
          {post.createdAt && <span className="pgc-date">{shortDate(post.createdAt)}</span>}
        </div>
      </div>
    </article>
  );
}

export function PostGrid({ children }) {
  return <div className="pgc-grid">{children}</div>;
}

export function PostGridSkeleton({ count = 6 }) {
  return (
    <div className="pgc-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pgc-card pgc-skeleton">
          <div className="pgc-media pgc-shimmer" />
          <div className="pgc-body">
            <div className="pgc-shimmer pgc-skeleton-line" />
            <div className="pgc-shimmer pgc-skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}
