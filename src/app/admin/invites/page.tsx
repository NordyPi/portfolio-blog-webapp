import { revokeInvite } from "@/app/admin/actions";
import { Avatar } from "@/components/avatar";
import { InviteForm } from "@/components/admin/invite-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

export default async function InvitesPage() {
  await requireAdmin();
  const [invites, family] = await Promise.all([
    db.invite.findMany({ where: { usedAt: null }, orderBy: { createdAt: "desc" } }),
    db.user.findMany({ where: { role: "FAMILY" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, image: true, createdAt: true } }),
  ]);
  const now = new Date();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-semibold">Family invites</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Family accounts can read and post comments. Each invite works once, for one email address, and expires after 7 days. Nobody can sign up without one.
        </p>
        <InviteForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-medium">{inv.email}</span>
                <span className={`text-xs ${inv.expiresAt < now ? "text-danger" : "text-muted"}`}>
                  {inv.expiresAt < now ? "Expired" : `Expires ${inv.expiresAt.toLocaleDateString("en-GB")}`}
                </span>
                <form action={revokeInvite.bind(null, inv.id)} className="ml-auto">
                  <button className="text-sm text-danger">Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Family members ({family.length})</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {family.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <Avatar name={u.name} image={u.image} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
