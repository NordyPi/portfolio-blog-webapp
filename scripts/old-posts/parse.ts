// Parses one hand-written post component from the old site (client/src/posts/postNN/postNN.js)
// into a neutral structure. It reads the code as a syntax tree (it never runs it), so formatting
// differences between posts don't matter.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import * as t from "@babel/types";

export type MediaRef = { type: "image" | "video"; file: string; className: string | null };

export type OldElement =
  | { kind: "text"; html: string }
  | { kind: "row"; items: MediaRef[] }
  | { kind: "combo"; imageFirst: boolean; html: string; image: MediaRef }
  | { kind: "unknown"; className: string | null; tag: string };

export type OldPost = {
  /** e.g. "post01" */
  id: string;
  dir: string;
  title: string | null;
  date: string | null;
  location: string | null;
  cover: MediaRef | null;
  elements: OldElement[];
  warnings: string[];
  /** Every inline tag seen inside text, for the survey. */
  inlineTags: Set<string>;
};

const tagName = (el: t.JSXElement) => {
  const n = el.openingElement.name;
  return t.isJSXIdentifier(n) ? n.name : "?";
};

function attr(el: t.JSXElement, name: string): t.JSXAttribute["value"] | undefined {
  for (const a of el.openingElement.attributes) {
    if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name) return a.value;
  }
  return undefined;
}

/** className="x" or className={"x"} */
function className(el: t.JSXElement): string | null {
  const v = attr(el, "className");
  if (t.isStringLiteral(v)) return v.value.trim();
  if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) return v.expression.value.trim();
  return null;
}

const childElements = (el: t.JSXElement) => el.children.filter((c): c is t.JSXElement => t.isJSXElement(c));

const escapeHtml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Converts JSX text content to the small HTML subset the new editor uses. */
function toHtml(nodes: t.JSXElement["children"], post: OldPost): string {
  let out = "";
  for (const n of nodes) {
    if (t.isJSXText(n)) out += escapeHtml(n.value.replace(/\s+/g, " "));
    else if (t.isJSXExpressionContainer(n)) {
      if (t.isStringLiteral(n.expression)) out += escapeHtml(n.expression.value);
      else if (t.isTemplateLiteral(n.expression) && n.expression.expressions.length === 0) {
        out += escapeHtml(n.expression.quasis.map((q) => q.value.cooked ?? "").join(""));
      } else if (!t.isJSXEmptyExpression(n.expression)) post.warnings.push(`Skipped a code expression inside text`);
    } else if (t.isJSXElement(n)) {
      const tag = tagName(n);
      post.inlineTags.add(tag);
      const inner = toHtml(n.children, post);
      if (tag === "br") out += "<br>";
      else if (tag === "strong" || tag === "b") out += `<strong>${inner}</strong>`;
      else if (tag === "em" || tag === "i") out += `<em>${inner}</em>`;
      else if (tag === "a") {
        const href = attr(n, "href");
        const url = t.isStringLiteral(href) ? href.value : t.isJSXExpressionContainer(href) && t.isStringLiteral(href.expression) ? href.expression.value : null;
        out += url ? `<a href="${escapeHtml(url)}">${inner}</a>` : inner;
      } else if (tag === "p") out += `<p>${inner.trim()}</p>`;
      else if (tag === "ul" || tag === "ol" || tag === "li") out += `<${tag}>${inner}</${tag}>`;
      else {
        post.warnings.push(`Unhandled inline <${tag}> kept as plain text`);
        out += inner;
      }
    } else if (t.isJSXFragment(n)) out += toHtml(n.children, post);
  }
  return out;
}

/** Wraps loose text in <p> so every text block is made of paragraphs. */
function asParagraphs(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("<p>") ? trimmed : `<p>${trimmed}</p>`;
}

function plainText(nodes: t.JSXElement["children"], post: OldPost) {
  return toHtml(nodes, post)
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOldPost(file: string): OldPost {
  const code = readFileSync(file, "utf8");
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  const post: OldPost = {
    id: path.basename(file, ".js"),
    dir: path.dirname(file),
    title: null,
    date: null,
    location: null,
    cover: null,
    elements: [],
    warnings: [],
    inlineTags: new Set(),
  };

  // import drip from "./drip.jpg"  ->  drip => "drip.jpg"
  const imports = new Map<string, string>();
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node) && node.source.value.startsWith("./")) {
      for (const s of node.specifiers) if (t.isImportDefaultSpecifier(s)) imports.set(s.local.name, node.source.value.slice(2));
    }
  }

  const mediaRef = (el: t.JSXElement, type: "image" | "video"): MediaRef | null => {
    // <img src={x}/>  or  <video><source src={x}/></video>
    const srcEl = type === "video" ? childElements(el).find((c) => tagName(c) === "source") ?? el : el;
    const src = attr(srcEl, "src");
    let file: string | null = null;
    if (t.isJSXExpressionContainer(src) && t.isIdentifier(src.expression)) file = imports.get(src.expression.name) ?? null;
    else if (t.isStringLiteral(src)) file = src.value.replace(/^\.\//, "");
    if (!file) {
      post.warnings.push(`Could not resolve the source of a <${tagName(el)}>`);
      return null;
    }
    return { type, file, className: className(el) };
  };

  // Find <div className="post-header"> (falls back to post-content), whose children are the post.
  let container: t.JSXElement | null = null;
  const visit = (node: t.Node) => {
    if (container) return;
    if (t.isJSXElement(node)) {
      const c = className(node);
      if (c === "post-header") container = node;
      else node.children.forEach(visit);
    } else if (t.isJSXFragment(node)) node.children.forEach(visit);
  };
  t.traverseFast(ast, (node) => {
    if (!container && t.isReturnStatement(node) && node.argument) visit(node.argument);
  });
  if (!container) {
    post.warnings.push("No post-header found");
    return post;
  }

  const rowFrom = (el: t.JSXElement) =>
    childElements(el)
      .map((c) => (tagName(c) === "img" ? mediaRef(c, "image") : tagName(c) === "video" ? mediaRef(c, "video") : null))
      .filter((x): x is MediaRef => x !== null);

  /**
   * Text blocks sometimes contain media too (e.g. a photo row nested inside a text-only div).
   * Split them in order: text before, the media, text after.
   */
  const pushTextWithMedia = (nodes: t.JSXElement["children"]) => {
    let pending: t.JSXElement["children"] = [];
    const flush = () => {
      const html = asParagraphs(toHtml(pending, post));
      if (html.replace(/<[^>]+>/g, "").trim()) post.elements.push({ kind: "text", html });
      pending = [];
    };
    for (const n of nodes) {
      if (t.isJSXElement(n) && tagName(n) === "div" && className(n) === "images-row") {
        flush();
        const items = rowFrom(n);
        if (items.length) post.elements.push({ kind: "row", items });
      } else if (t.isJSXElement(n) && tagName(n) === "div") {
        // A text block nested inside a text block (post23): handle it as its own block, in order.
        flush();
        pushTextWithMedia(n.children);
      } else if (t.isJSXElement(n) && (tagName(n) === "img" || tagName(n) === "video")) {
        flush();
        const m = mediaRef(n, tagName(n) === "video" ? "video" : "image");
        if (m) post.elements.push({ kind: "row", items: [m] });
      } else pending.push(n);
    }
    flush();
  };

  for (const el of childElements(container)) {
    const tag = tagName(el);
    const cls = className(el);

    if (tag === "video" || (tag === "img" && cls !== "image")) {
      // A lone video/photo directly between blocks.
      const m = mediaRef(el, tag === "video" ? "video" : "image");
      if (m) post.elements.push({ kind: "row", items: [m] });
    } else if (tag === "h1" && !post.title) {
      post.title = plainText(el.children, post);
    } else if (cls === "image" && !post.cover) {
      const img = childElements(el).find((c) => tagName(c) === "img");
      const src = img ? attr(img, "src") : undefined;
      // A few posts still have the template's src={"COVERIMAGE"} placeholder: treat as no cover.
      const placeholder = t.isJSXExpressionContainer(src) && t.isStringLiteral(src.expression) && src.expression.value === "COVERIMAGE";
      if (img && !placeholder) post.cover = mediaRef(img, "image");
    } else if (cls === "post-details") {
      for (const p of childElements(el)) {
        const text = plainText(p.children, post);
        const m = text.match(/^(Date|Location)\s*:\s*(.*)$/i);
        if (m?.[1].toLowerCase() === "date") post.date = m[2].trim();
        else if (m?.[1].toLowerCase() === "location") post.location = m[2].trim();
        else if (text) post.warnings.push(`Unrecognized post-details line: "${text}"`);
      }
    } else if (cls === "text-only") {
      pushTextWithMedia(el.children);
    } else if (cls === "images-row") {
      const items = rowFrom(el);
      if (items.length) post.elements.push({ kind: "row", items });
    } else if (cls === "combo") {
      const kids = childElements(el);
      const mediaKids = kids.filter((c) => tagName(c) === "img" || tagName(c) === "video");
      const textNodes = el.children.filter((n) => !mediaKids.includes(n as t.JSXElement));
      const html = asParagraphs(toHtml(textNodes, post));
      const hasText = html.replace(/<[^>]+>/g, "").trim() !== "";
      if (mediaKids.length === 1 && hasText) {
        const image = mediaRef(mediaKids[0], tagName(mediaKids[0]) === "video" ? "video" : "image");
        if (image) post.elements.push({ kind: "combo", imageFirst: kids.indexOf(mediaKids[0]) === 0, html, image });
      } else {
        // e.g. a photo and a video side by side with no text: really a row.
        if (hasText) post.elements.push({ kind: "text", html });
        const items = rowFrom(el);
        if (items.length) post.elements.push({ kind: "row", items });
      }
    } else if (cls === "spacer") {
      // not needed: the new layout spaces blocks itself
    } else {
      post.elements.push({ kind: "unknown", className: cls, tag });
    }
  }
  return post;
}
