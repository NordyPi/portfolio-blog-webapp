import { PostDetailPage, postMetadata } from "@/components/post-pages";

export function generateMetadata({ params }: PageProps<"/[lang]/portfolio/[slug]">) {
  return postMetadata(params, "PROJECT");
}

export default function PortfolioItem({ params }: PageProps<"/[lang]/portfolio/[slug]">) {
  return <PostDetailPage params={params} type="PROJECT" />;
}
