"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Avatar } from "@/components/avatar";
import { cropPreview, ImageCropDialog, type CropArea } from "@/components/image-crop-dialog";
import type { Dictionary } from "@/lib/dictionaries";

type Pending = { file: File; area: CropArea; view: { crop: { x: number; y: number }; zoom: number } };

export function ProfileForm({ user, t }: { user: { name: string; image: string | null; email: string }; t: Dictionary["profile"] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [preview, setPreview] = useState<string | null>(user.image);
  // A photo chosen but not saved yet, with the crop the user picked.
  const [pending, setPending] = useState<Pending | null>(null);
  // The photo currently open in the crop dialog.
  const [cropping, setCropping] = useState<{ file: File; view?: Pending["view"] } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    data.set("name", name);
    if (pending) {
      data.set("photo", pending.file);
      data.set("crop", JSON.stringify(pending.area));
    }
    startTransition(async () => {
      const res = await updateProfile(data);
      setMessage(res.ok ? { ok: true, text: t.saved } : { ok: false, text: res.error });
      if (res.ok) {
        setPending(null);
        router.refresh();
      }
    });
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={save}>
      <div className="flex items-center gap-5">
        <Avatar name={name} image={preview} size={96} />
        <div>
          <span className="block text-sm font-medium">{t.photoLabel}</span>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-full bg-surface-2 px-4 py-1.5 text-sm font-medium hover:bg-border"
            >
              {t.choosePhoto}
            </button>
            {pending && (
              <button
                type="button"
                onClick={() => setCropping({ file: pending.file, view: pending.view })}
                className="rounded-full px-3 py-1.5 text-sm text-accent"
              >
                {t.adjustPhoto}
              </button>
            )}
          </div>
          <span className="mt-1 block text-xs text-muted">{t.photoHelp}</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropping({ file: f });
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">{t.nameLabel}</span>
        <input
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
      </label>
      <p className="text-sm text-muted">{user.email}</p>
      {message && <p className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-fg disabled:opacity-60">
        {t.save}
      </button>

      {cropping && (
        <ImageCropDialog
          file={cropping.file}
          aspect={1}
          round
          initialCrop={cropping.view}
          labels={{ title: t.cropTitle, zoom: t.cropZoom, cancel: t.cropCancel, apply: t.cropApply, unreadable: t.cropUnreadable }}
          onCancel={() => setCropping(null)}
          onConfirm={async (area, view) => {
            if (!area) return;
            setPending({ file: cropping.file, area, view });
            setPreview(await cropPreview(cropping.file, area, 192));
            setCropping(null);
          }}
        />
      )}
    </form>
  );
}
