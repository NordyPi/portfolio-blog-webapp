"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createInvite } from "@/app/admin/actions";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 max-w-xl">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createInvite(email);
            setCopied(false);
            if (!res.ok) return setResult({ ok: false, text: res.error });
            setResult({ ok: true, text: res.message ?? "Invite created", link: res.data.link });
            setEmail("");
            router.refresh();
          });
        }}
      >
        <input
          type="email"
          required
          placeholder="family.member@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <button disabled={pending} className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
          Send invite
        </button>
      </form>
      {result && (
        <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-surface-2" : "bg-danger/10 text-danger"}`}>
          <p>{result.text}</p>
          {result.link && (
            <div className="mt-2">
              <p className="text-xs text-muted">You can also send this link yourself (e.g. by message). It&apos;s shown only once and works only for that email:</p>
              <div className="mt-1 flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2 py-1 text-xs">{result.link}</code>
                <button
                  type="button"
                  className="text-xs font-medium text-accent"
                  onClick={() => navigator.clipboard.writeText(result.link!).then(() => setCopied(true))}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
