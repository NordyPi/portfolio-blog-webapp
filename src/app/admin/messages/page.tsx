import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

export default async function MessagesPage() {
  await requireAdmin();
  const messages = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Messages</h1>
      <p className="mt-2 text-muted">Everything sent through the contact form (also emailed to you when email is configured).</p>
      <ul className="mt-6 space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">{m.name}</span>
              <a href={`mailto:${m.email}`} className="text-sm text-accent">
                {m.email}
              </a>
              <span className="ml-auto text-xs text-muted">{m.createdAt.toLocaleString("en-GB")}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
          </li>
        ))}
        {messages.length === 0 && <li className="text-sm text-muted">No messages yet.</li>}
      </ul>
    </div>
  );
}
