import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { db } from "@/lib/db";
import { imagePath } from "@/lib/media";
import { UPLOAD_DIR } from "@/lib/upload-dir";

export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Cloudflare's free plan rejects request bodies over 100 MB, so stay under it. */
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
const IMAGE_WIDTHS = [640, 1280, 1920];

export class UploadError extends Error {}

const newId = () => randomUUID().replaceAll("-", "");

/**
 * Stores an image as WebP renditions in several widths.
 * - .rotate() bakes the EXIF orientation into the pixels first.
 * - sharp writes NO metadata unless asked to, so EXIF/GPS/camera data is stripped from every output.
 */
export async function saveImage(input: Buffer, opts: { alt?: string; widths?: number[] } = {}) {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new UploadError("Unsupported image. Please upload a JPG, PNG or WebP (iPhone HEIC photos: export as JPG first).");
  }
  if (!meta.width || !meta.height) throw new UploadError("Could not read image dimensions.");

  // Orientations 5–8 are rotated 90°, so width and height swap once applied.
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = swap ? meta.height : meta.width;
  const srcH = swap ? meta.width : meta.height;

  const targets = (opts.widths ?? IMAGE_WIDTHS).filter((w) => w < srcW);
  const largest = Math.min(srcW, Math.max(...(opts.widths ?? IMAGE_WIDTHS)));
  const widths = [...new Set([...targets, largest])].sort((a, b) => a - b);

  const id = newId();
  const dir = path.join(UPLOAD_DIR, "images", id);
  await mkdir(dir, { recursive: true });

  try {
    let largestBytes = 0;
    for (const w of widths) {
      const info = await sharp(input)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(UPLOAD_DIR, imagePath(id, w)));
      if (w === largest) largestBytes = info.size;
    }
    return await db.media.create({
      data: {
        id,
        kind: "IMAGE",
        path: imagePath(id, largest),
        mimeType: "image/webp",
        width: largest,
        height: Math.round((srcH * largest) / srcW),
        widths,
        sizeBytes: largestBytes,
        alt: opts.alt ?? "",
      },
    });
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Step 1 of a video upload: store the raw file and create a PROCESSING Media row.
 * Call processVideo(id) afterwards (in the background) to produce the playable file.
 */
export async function stageVideo(input: Buffer, opts: { alt?: string } = {}) {
  const id = newId();
  const dir = path.join(UPLOAD_DIR, "videos", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "source"), input);
  return db.media.create({
    data: {
      id,
      kind: "VIDEO",
      status: "PROCESSING",
      path: `videos/${id}/video.mp4`,
      mimeType: "video/mp4",
      sizeBytes: input.length,
      widths: [],
      alt: opts.alt ?? "",
    },
  });
}

function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    // turbopackIgnore: ffmpeg is a system binary, not a project file to trace into the build.
    const proc = spawn(/*turbopackIgnore: true*/ process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${stderr}`))));
  });
}

/**
 * Step 2: transcode to H.264/AAC MP4 (plays in every browser, including iPhone HEVC sources),
 * cap the short side at 1080px, and drop ALL metadata (phones embed the recording location).
 * Also extracts a WebP poster frame. Marks the Media row READY or FAILED.
 */
export async function processVideo(id: string) {
  const dir = path.join(UPLOAD_DIR, "videos", id);
  const source = path.join(dir, "source");
  const output = path.join(dir, "video.mp4");
  const posterJpg = path.join(dir, "poster.jpg");
  try {
    await ffmpeg([
      "-y", "-i", source,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-map_metadata", "-1", "-map_chapters", "-1",
      "-vf", "scale='if(gt(iw,ih),-2,min(1080,iw))':'if(gt(iw,ih),min(1080,ih),-2)'",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ]);
    // Poster from half a second in (or the first frame for very short clips).
    await ffmpeg(["-y", "-ss", "0.5", "-i", output, "-frames:v", "1", posterJpg]).catch(() =>
      ffmpeg(["-y", "-i", output, "-frames:v", "1", posterJpg]),
    );
    const posterPath = `videos/${id}/poster.webp`;
    const poster = await sharp(posterJpg).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, posterPath));
    const { size } = await stat(output);

    await db.media.update({
      where: { id },
      data: { status: "READY", width: poster.width, height: poster.height, posterPath, sizeBytes: size },
    });
  } catch (err) {
    console.error(`Video ${id} failed to process:`, err);
    await db.media.update({ where: { id }, data: { status: "FAILED" } });
  } finally {
    await rm(source, { force: true });
    await rm(posterJpg, { force: true });
  }
}

/** Square, small avatar for family profiles. Returns the public URL. */
export async function saveAvatar(input: Buffer, userId: string) {
  try {
    await sharp(input).metadata();
  } catch {
    throw new UploadError("Unsupported image. Please upload a JPG, PNG or WebP.");
  }
  const rel = `avatars/${userId}-${newId().slice(0, 8)}.webp`;
  await mkdir(path.join(UPLOAD_DIR, "avatars"), { recursive: true });
  await sharp(input).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 82 }).toFile(path.join(UPLOAD_DIR, rel));
  return `/media/${rel}`;
}
