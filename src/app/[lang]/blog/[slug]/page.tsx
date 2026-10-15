import { PostDetailPage, postMetadata } from "@/components/post-pages";

export function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">) {
  return postMetadata(params, "BLOG");
}

export default function BlogPost({ params }: PageProps<"/[lang]/blog/[slug]">) {
  return <PostDetailPage params={params} type="BLOG" />;
}
