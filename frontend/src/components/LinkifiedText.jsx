import React from "react";
import { splitLinks } from "../utlis/linkify";

// Search terms are user input — escape them before building a RegExp, or
// typing "(" or "?" into in-chat search throws and takes the chat down.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (text, query, keyPrefix) => {
  if (!query) return text;
  return text.split(new RegExp(`(${escapeRegExp(query)})`, "gi")).map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${keyPrefix}-${i}`} className="search-match-highlight">{part}</mark>
    ) : (
      part
    )
  );
};

/**
 * Renders plain user text with http(s) and www. links made clickable (new tab,
 * noopener). Optionally highlights a search term, including inside links.
 * Links stop click propagation so tapping one doesn't also trigger the
 * surrounding card or message handler.
 */
export default function LinkifiedText({ text, linkClassName = "", highlightQuery = "" }) {
  if (!text) return null;
  return splitLinks(text).map((segment, i) =>
    segment.href ? (
      <a
        key={i}
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {highlight(segment.text, highlightQuery, i)}
      </a>
    ) : (
      <React.Fragment key={i}>{highlight(segment.text, highlightQuery, i)}</React.Fragment>
    )
  );
}
