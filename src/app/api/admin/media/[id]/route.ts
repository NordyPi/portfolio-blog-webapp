import { db } from "@/lib/db";
import { mediaSelect, toMediaView } from "@/lib/media";
import { getCurrentUser } from "@/lib/session";

/** Lets the editor poll a video's processing status. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/media/[id]">) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return Response.json({ error: "Not found" }, { status: 404 });

  const { id } = await ctx.params;
  const media = await db.media.findUnique({ where: { id }, select: { ...mediaSelect, status: true } });
  if (!media) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ media: toMediaView(media), status: media.status });
}
