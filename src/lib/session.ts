import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/lib/auth";

// These read request headers, so with Cache Components every caller must sit inside <Suspense>
// (or be a Server Action / Route Handler).

export const getSession = cache(async () => {
  // Session checks compare timestamps, so they must run per request (never in a prerender or prefetch).
  await connection();
  return auth.api.getSession({ headers: await headers() });
});

export type CurrentUser = { id: string; name: string; email: string; image: string | null; role: "ADMIN" | "FAMILY" };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const { id, name, email, image, role } = session.user;
  return { id, name, email, image: image ?? null, role: role === "ADMIN" ? "ADMIN" : "FAMILY" };
}

/** Use in admin pages, Server Actions and Route Handlers. Unknown users get a 404, not a hint that /admin exists. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  return user;
}

export async function requireMember() {
  const user = await getCurrentUser();
  if (!user) notFound();
  return user;
}
