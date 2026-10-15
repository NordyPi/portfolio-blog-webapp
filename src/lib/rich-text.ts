import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Rich text comes from the Tiptap editor (and from DeepL) as HTML. It is sanitized on every save
 * against this small allowlist, so rendering it later with dangerouslySetInnerHTML is safe.
 */
export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "s", "a", "ul", "ol", "li", "blockquote"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      b: "strong",
      i: "em",
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}

/** "<p></p>" and friends count as empty. */
export function isEmptyRichText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim().length === 0;
}
