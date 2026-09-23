import { isSafeHttpUrl } from "./safeUrl";

// http(s)://… or www.… up to the next whitespace.
const URL_PATTERN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
// Punctuation that ends a sentence rather than the link: "see example.com/x."
const TRAILING_PUNCTUATION = /[.,!?;:'"]+$/;


/** Drops sentence punctuation and an unmatched closing bracket off the end of a URL. */
const trimUrl = (raw) => {
  let url = raw.replace(TRAILING_PUNCTUATION, "");
  // Keep "…/Foo_(bar)" but not the ")" in "(see https://x.com)".
  while (url.endsWith(")") && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }
  return url;
};

/** Splits text into plain `{ text }` and link `{ text, href }` segments. */
export const splitLinks = (text) => {
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    const start = match.index;
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    if (!url || !isSafeHttpUrl(href)) continue;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: url, href });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
};
