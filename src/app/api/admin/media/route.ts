import { after } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { toMediaView } from "@/lib/media";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, processVideo, saveImage, stageVideo, UploadError } from "@/lib/uploads";

/** Admin-only upload endpoint. Body: multipart form with `file` (and optional `alt`). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return Response.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No file uploaded." }, { status: 400 });
  const alt = String(form?.get("alt") ?? "").slice(0, 300);

  try {
    if (file.type.startsWith("video/")) {
      if (file.size > MAX_VIDEO_BYTES) return Response.json({ error: "Videos must be under 95 MB. Use a YouTube link for longer videos." }, { status: 413 });
      const media = await stageVideo(Buffer.from(await file.arrayBuffer()), { alt });
      // Transcoding can take a while, so it runs after the response is sent; the editor polls for status.
      after(() => processVideo(media.id));
      return Response.json({ media: toMediaView(media), status: media.status });
    }
    if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "Images must be under 30 MB." }, { status: 413 });
    const media = await saveImage(Buffer.from(await file.arrayBuffer()), { alt });
    return Response.json({ media: toMediaView(media), status: media.status });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    console.error("Upload failed:", e);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
