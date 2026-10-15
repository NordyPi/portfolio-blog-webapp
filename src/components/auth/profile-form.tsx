"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Avatar } from "@/components/avatar";

export function ProfileForm({
  user,
  labels,
}: {
  user: { name: string; image: string | null; email: string };
  labels: { name: string; photo: string; photoHelp: string; save: string; saved: string };
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(user.image);
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await updateProfile(data);
          setMessage(res.ok ? { ok: true, text: labels.saved } : { ok: false, text: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar name={name} image={preview} size={80} />
        <label className="block">
          <span className="text-sm font-medium">{labels.photo}</span>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-fg"
          />
          <span className="mt-1 block text-xs text-muted">{labels.photoHelp}</span>
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">{labels.name}</span>
        <input
          name="name"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
      </label>
      <p className="text-sm text-muted">{user.email}</p>
      {message && <p className={`text-sm ${message.ok ? "text-accent" : "text-danger"}`}>{message.text}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-fg disabled:opacity-60">
        {labels.save}
      </button>
    </form>
  );
}
