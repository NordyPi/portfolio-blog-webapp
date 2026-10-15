"use client";

import { useState, useTransition } from "react";
import { requestJoinLink } from "@/app/actions/join";
import type { Locale } from "@/lib/i18n";

export function JoinForm({
  token,
  lang,
  labels,
}: {
  token: string;
  lang: Locale;
  labels: { name: string; submit: string; sent: string; invalid: string };
}) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<"sent" | "invalid" | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) {
    return <p className="mt-8 rounded-2xl border border-border bg-surface p-5">{result === "sent" ? labels.sent : labels.invalid}</p>;
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult((await requestJoinLink({ token, name, lang })).ok ? "sent" : "invalid"));
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">{labels.name}</span>
        <input
          required
          maxLength={60}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
      </label>
      <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg disabled:opacity-60">
        {labels.submit}
      </button>
    </form>
  );
}
