"use client";

import { useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

export type { Area as CropArea };

export type CropDialogLabels = { title: string; zoom: string; cancel: string; apply: string; skip?: string; unreadable: string };

/**
 * Lets the user position and zoom a photo inside a frame before uploading.
 * Only the crop rectangle (in the photo's own pixels) is sent to the server, which crops the
 * full-resolution original — so quality is preserved and EXIF rotation is handled consistently.
 */
export function ImageCropDialog({
  file,
  aspect,
  round = false,
  initialCrop,
  labels,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect: number;
  /** Circular guide (profile photos). */
  round?: boolean;
  initialCrop?: { crop: { x: number; y: number }; zoom: number };
  labels: CropDialogLabels;
  onCancel: () => void;
  /** `area` is null when the user chose to use the whole photo (only offered when `labels.skip` is set). */
  onConfirm: (area: Area | null, view: { crop: { x: number; y: number }; zoom: number }) => void;
}) {
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const [crop, setCrop] = useState(initialCrop?.crop ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [area, setArea] = useState<Area | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const button = "rounded-full px-4 py-2 text-sm font-medium";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={labels.title}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-xl">
        <h2 className="px-5 pt-4 font-display text-xl font-semibold">{labels.title}</h2>

        <div className="relative mt-3 h-[min(60vh,420px)] bg-black">
          {unreadable ? (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{labels.unreadable}</p>
          ) : (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={round ? "round" : "rect"}
              showGrid={!round}
              minZoom={1}
              maxZoom={5}
              zoomSpeed={0.3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
              mediaProps={{ onError: () => setUnreadable(true) }}
            />
          )}
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0 text-muted">{labels.zoom}</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={zoom}
              disabled={unreadable}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onCancel} className={`${button} text-muted hover:text-fg`}>
              {labels.cancel}
            </button>
            {labels.skip && (
              <button type="button" onClick={() => onConfirm(null, { crop, zoom })} className={`${button} border border-border`}>
                {labels.skip}
              </button>
            )}
            <button
              type="button"
              disabled={!area || unreadable}
              onClick={() => area && onConfirm(area, { crop, zoom })}
              className={`${button} bg-accent text-accent-fg disabled:opacity-50`}
            >
              {labels.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders the chosen crop to a small data URL, for previewing before upload. */
export async function cropPreview(file: File, area: Area, width = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // browsers apply EXIF orientation here, matching the cropper
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((width * area.height) / area.width);
    canvas.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
