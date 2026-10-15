import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { loadEditorState } from "@/lib/admin-posts";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const state = await loadEditorState(id);
  if (!state) notFound();
  // key: remount the editor if a different post is opened.
  return <PostEditor key={state.post.id} initial={state} />;
}
