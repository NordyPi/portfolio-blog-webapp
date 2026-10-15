"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorMedia } from "@/lib/editor-types";

type UploadResult = { media: EditorMedia } | { error: string };

async function upload(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
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

/** Image placeholder / preview with upload, replace and remove. */
export function ImageSlot({
  mediaId,
  media,
  onChange,
  onUploaded,
  aspect,
  label = "Upload image",
}: {
  mediaId: string | null;
  media: Record<string, EditorMedia>;
  onChange: (id: string | null) => void;
  onUploaded: (m: EditorMedia) => void;
  /** Tailwind aspect class, e.g. "aspect-[16/9]" */
  aspect: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = mediaId ? media[mediaId] : undefined;

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
    <div>
      <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${aspect}`}>
        {m && (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={m.src} srcSet={m.srcSet ?? undefined} sizes="600px" alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className={`absolute inset-0 flex flex-wrap items-center justify-center gap-2 p-2 ${m ? "bg-black/0 opacity-0 transition hover:bg-black/40 hover:opacity-100 focus-within:opacity-100" : ""}`}>
          {busy ? (
            <span className="rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm">Uploading…</span>
          ) : (
            <>
              <UploadButton accept="image/jpeg,image/png,image/webp,image/avif" label={m ? "Replace" : label} onFile={handle} />
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
          <UploadButton accept="video/mp4,video/quicktime,video/webm" label={m ? "Replace video" : "Upload video (max 95 MB)"} onFile={handle} />
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
