import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

export default async function SubscribersPage() {
  await requireAdmin();
  const subscribers = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  const count = (s: string) => subscribers.filter((x) => x.status === s).length;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Subscribers</h1>
      <p className="mt-2 text-muted">
        {count("CONFIRMED")} confirmed · {count("PENDING")} awaiting confirmation · {count("UNSUBSCRIBED")} unsubscribed
      </p>
      <p className="mt-1 text-sm text-muted">Only confirmed subscribers receive new-post emails.</p>
      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
        {subscribers.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium">{s.email}</span>
            <span className="text-xs text-muted">{s.status.toLowerCase()}</span>
            <span className="ml-auto text-xs text-muted">since {s.createdAt.toLocaleDateString("en-GB")}</span>
          </li>
        ))}
        {subscribers.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No subscribers yet.</li>}
      </ul>
    </div>
  );
}
