import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOAD_DIR } from "@/lib/upload-dir";

// Serves uploaded files in development. In production nginx serves /media/ straight from the
// uploads volume and requests never reach this handler.

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(request: Request, ctx: RouteContext<"/media/[...path]">) {
  const { path: parts } = await ctx.params;
  const file = path.resolve(UPLOAD_DIR, ...parts);
  // Refuse anything that resolves outside the upload directory (e.g. "../../.env").
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });

  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers = new Headers({ "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" });

  // Range support so <video> can seek.
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(info.size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers });
}
