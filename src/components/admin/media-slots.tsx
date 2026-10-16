"use client";

import { useEffect, useRef, useState } from "react";
import { ImageCropDialog, type CropArea } from "@/components/image-crop-dialog";
import type { EditorMedia } from "@/lib/editor-types";

type UploadResult = { media: EditorMedia } | { error: string };

async function upload(file: File, crop?: CropArea | null): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  if (crop) body.set("crop", JSON.stringify(crop));
  try {
    const res = await fetch("/api/admin/media", { method: "POST", body });
    const json = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
    if (!res.ok) return { error: json.error ?? `Upload failed (${res.status})` };
    return { media: { ...json.media, status: json.status } };
  } catch {
    return { error: "Upload failed — check your connection." };
  }
}

function UploadButton({
  accept,
  label,
  onFile,
  disabled,
}: {
  accept: string;
  label: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-border hover:bg-surface-2 disabled:opacity-50"
      >
        {label}
      </button>
    </>
  );
}


/** While a video is still being transcoded on the server, poll until it's READY (or FAILED). */
function useProcessingPoll(m: EditorMedia | undefined, onUploaded: (m: EditorMedia) => void) {
  useEffect(() => {
    if (m?.status !== "PROCESSING") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/admin/media/${m.id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status !== "PROCESSING") onUploaded({ ...json.media, status: json.status });
    }, 3000);
    return () => clearInterval(timer);
  }, [m?.id, m?.status, onUploaded]);
}

const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";
const VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";

/**
 * A photo slot (optionally photo-or-video). Choosing a photo opens the cropper framed to the slot's
 * shape, then uploads. Without a `ratio` the photo is uploaded whole (no cropper) and previewed at its
 * own shape. With `allowVideo`, videos are uploaded as-is and transcoded on the server.
 */
export function MediaSlot({
  mediaId,
  media,
  onChange,
  onUploaded,
  ratio,
  allowVideo = false,
  label = "Upload image",
}: {
  mediaId: string | null;
  media: Record<string, EditorMedia>;
  onChange: (id: string | null) => void;
  onUploaded: (m: EditorMedia) => void;
  /** Width / height of the slot, e.g. 16 / 9: the preview box and crop frame. Omit for uncropped photos. */
  ratio?: number;
  allowVideo?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const m = mediaId ? media[mediaId] : undefined;
  useProcessingPoll(m, onUploaded);

  async function handle(file: File, crop: CropArea | null) {
    setCropping(null);
    setBusy(true);
    setError(null);
    const res = await upload(file, crop);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    onUploaded(res.media);
    onChange(res.media.id);
  }

  function choose(file: File) {
    if (file.type.startsWith("video/")) return handle(file, null);
    if (ratio === undefined) return handle(file, null);
    setCropping(file);
  }

  // Uncropped photos preview at their own shape (3:2 while empty).
  const boxRatio = ratio ?? (m?.width && m?.height ? m.width / m.height : 3 / 2);

  return (
    <div>
      {cropping && ratio !== undefined && (
        <ImageCropDialog
          file={cropping}
          aspect={ratio}
          labels={{
            title: "Frame your photo",
            zoom: "Zoom",
            cancel: "Cancel",
            apply: "Crop & upload",
            skip: "Use whole photo",
            unreadable: "This browser can't preview this photo (HEIC?). Export it as JPG, or use the whole photo.",
          }}
          onCancel={() => setCropping(null)}
          onConfirm={(area) => handle(cropping, area)}
        />
      )}
      <div className="relative overflow-hidden rounded-xl bg-surface-2" style={{ aspectRatio: boxRatio }}>
        {m?.kind === "VIDEO" ? (
          m.status === "READY" ? (
            <video src={m.src} poster={m.poster ?? undefined} controls className="absolute inset-0 size-full bg-black object-contain" />
          ) : (
            <p className={`absolute inset-0 flex items-center justify-center p-3 text-center text-xs ${m.status === "FAILED" ? "text-danger" : "text-muted"}`}>
              {m.status === "FAILED" ? "Video couldn't be processed" : "Processing video…"}
            </p>
          )
        ) : (
          m && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img
              src={m.src}
              srcSet={m.srcSet ?? undefined}
              sizes="600px"
              alt=""
              className={`absolute inset-0 size-full ${ratio === undefined ? "object-contain" : "object-cover"}`}
            />
          )
        )}
        {/* Controls: always visible when empty; on hover/focus over existing media (kept clear of video controls). */}
        <div
          className={`absolute inset-x-0 top-0 flex flex-wrap items-center justify-center gap-2 p-2 ${
            m ? "opacity-0 transition hover:opacity-100 focus-within:opacity-100" : "bottom-0"
          }`}
        >
          {busy ? (
            <span className="rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm">Uploading…</span>
          ) : (
            <>
              <UploadButton
                accept={allowVideo ? `${IMAGE_TYPES},${VIDEO_TYPES}` : IMAGE_TYPES}
                label={m ? "Replace" : allowVideo ? "Photo or video" : label}
                onFile={choose}
              />
              {m && (
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-danger shadow-sm ring-1 ring-border"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Uploaded video with processing status. Polls until the server finishes transcoding. */
export function VideoSlot({
  mediaId,
  media,
  onChange,
  onUploaded,
}: {
  mediaId: string | null;
  media: Record<string, EditorMedia>;
  onChange: (id: string | null) => void;
  onUploaded: (m: EditorMedia) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = mediaId ? media[mediaId] : undefined;
  useProcessingPoll(m, onUploaded);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    const res = await upload(file);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    onUploaded(res.media);
    onChange(res.media.id);
  }

  return (
    <div className="space-y-2">
      {m?.status === "READY" && <video src={m.src} poster={m.poster ?? undefined} controls className="max-h-80 rounded-xl bg-black" />}
      {m?.status === "PROCESSING" && <p className="rounded-xl bg-surface-2 p-4 text-sm">Processing video… this can take a minute. You can keep editing.</p>}
      {m?.status === "FAILED" && <p className="rounded-xl bg-surface-2 p-4 text-sm text-danger">This video couldn&apos;t be processed. Try another file.</p>}
      <div className="flex gap-2">
        {busy ? (
          <span className="text-sm text-muted">Uploading…</span>
        ) : (
          <UploadButton accept={VIDEO_TYPES} label={m ? "Replace video" : "Upload video (max 95 MB)"} onFile={handle} />
        )}
        {m && !busy && (
          <button type="button" onClick={() => onChange(null)} className="text-sm text-danger">
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
