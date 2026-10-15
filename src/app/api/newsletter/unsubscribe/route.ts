import { unsubscribe } from "@/lib/newsletter";

/** RFC 8058 one-click unsubscribe, POSTed by mail clients from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) await unsubscribe(token);
  return new Response(null, { status: 204 });
}
