"use client";

import { useState, useTransition } from "react";
import { contactAction, subscribeAction } from "@/app/actions/contact";

const input = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent";
const button = "rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg disabled:opacity-60";

/** Visually hidden field that only bots fill in. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );
}

function Status({ state, success, error }: { state: "ok" | "error" | null; success: string; error: string }) {
  if (!state) return null;
  return <p className={`text-sm ${state === "ok" ? "text-accent" : "text-danger"}`}>{state === "ok" ? success : error}</p>;
}

export function SubscribeForm({ labels }: { labels: { email: string; submit: string; success: string; error: string } }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"ok" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  if (state === "ok") return <p className="mt-6 font-medium text-accent">{labels.success}</p>;
  return (
    <form
      className="relative mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setState((await subscribeAction({ email, website })).ok ? "ok" : "error"));
      }}
    >
      <Honeypot value={website} onChange={setWebsite} />
      <label className="block">
        <span className="text-sm font-medium">{labels.email}</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      <Status state={state} success={labels.success} error={labels.error} />
      <button type="submit" disabled={pending} className={button}>
        {labels.submit}
      </button>
    </form>
  );
}

export function ContactForm({
  labels,
}: {
  labels: { name: string; email: string; message: string; submit: string; success: string; error: string };
}) {
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = useState<"ok" | "error" | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (state === "ok") return <p className="mt-6 font-medium text-accent">{labels.success}</p>;
  return (
    <form
      className="relative mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setState((await contactAction(form)).ok ? "ok" : "error"));
      }}
    >
      <Honeypot value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
      <label className="block">
        <span className="text-sm font-medium">{labels.name}</span>
        <input required maxLength={100} autoComplete="name" value={form.name} onChange={set("name")} className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{labels.email}</span>
        <input type="email" required autoComplete="email" value={form.email} onChange={set("email")} className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{labels.message}</span>
        <textarea required rows={6} maxLength={5000} value={form.message} onChange={set("message")} className={`${input} resize-y`} />
      </label>
      <Status state={state} success={labels.success} error={labels.error} />
      <button type="submit" disabled={pending} className={button}>
        {labels.submit}
      </button>
    </form>
  );
}
