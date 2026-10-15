import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { imagePath } from "@/lib/media";
import { UPLOAD_DIR } from "@/lib/upload-dir";

export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Cloudflare's free plan rejects request bodies over 100 MB, so stay under it. */
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
const IMAGE_WIDTHS = [640, 1280, 1920];

export class UploadError extends Error {}

const newId = () => randomUUID().replaceAll("-", "");

/** Crop rectangle in pixels of the upright (EXIF-oriented) image, as chosen in the browser's cropper. */
const cropSchema = z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() });
export type CropRect = z.infer<typeof cropSchema>;

/** Reads the optional `crop` form field (JSON) sent alongside an uploaded file. */
export function cropFromForm(form: FormData): CropRect | null {
  const raw = form.get("crop");
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed = cropSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Decodes an upload to raw pixels: EXIF orientation applied (so the crop matches what the browser
 * showed), then the optional crop. Later resizes start from these pixels, so nothing is compressed twice.
 */
async function decode(input: Buffer, crop: CropRect | null | undefined) {
  let oriented;
  try {
    oriented = await sharp(input).rotate().raw().toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("Unsupported image. Please upload a JPG, PNG or WebP (iPhone HEIC photos: export as JPG first).");
  }
  const { width: W, height: H, channels } = oriented.info;
  if (!crop) return { data: oriented.data, width: W, height: H, channels };

  // Clamp to the image so a slightly-off rectangle from the browser can never fail the upload.
  const left = Math.min(Math.max(0, Math.round(crop.x)), W - 1);
  const top = Math.min(Math.max(0, Math.round(crop.y)), H - 1);
  const width = Math.max(1, Math.min(Math.round(crop.width), W - left));
  const height = Math.max(1, Math.min(Math.round(crop.height), H - top));
  const cropped = await sharp(oriented.data, { raw: { width: W, height: H, channels } })
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: cropped.data, width: cropped.info.width, height: cropped.info.height, channels: cropped.info.channels };
}

/**
 * Stores an image as WebP renditions in several widths, optionally cropped first.
 * sharp writes NO metadata unless asked to, so EXIF/GPS/camera data is stripped from every output.
 */
export async function saveImage(input: Buffer, opts: { alt?: string; crop?: CropRect | null } = {}) {
  const px = await decode(input, opts.crop);
  const fromPixels = () => sharp(px.data, { raw: { width: px.width, height: px.height, channels: px.channels } });

  const largest = Math.min(px.width, Math.max(...IMAGE_WIDTHS));
  const widths = [...new Set([...IMAGE_WIDTHS.filter((w) => w < px.width), largest])].sort((a, b) => a - b);

  const id = newId();
  const dir = path.join(UPLOAD_DIR, "images", id);
  await mkdir(dir, { recursive: true });

  try {
    let largestBytes = 0;
    for (const w of widths) {
      const info = await fromPixels()
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
        height: Math.round((px.height * largest) / px.width),
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
export async function saveAvatar(input: Buffer, userId: string, crop?: CropRect | null) {
  const px = await decode(input, crop);
  const rel = `avatars/${userId}-${newId().slice(0, 8)}.webp`;
  await mkdir(path.join(UPLOAD_DIR, "avatars"), { recursive: true });
  // fit "cover" still centers sensibly if no (or a non-square) crop was sent.
  await sharp(px.data, { raw: { width: px.width, height: px.height, channels: px.channels } })
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOAD_DIR, rel));
  return `/media/${rel}`;
}
