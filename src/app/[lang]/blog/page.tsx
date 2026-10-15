import type { Metadata } from "next";
import { PostIndexPage } from "@/components/post-pages";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/blog">): Promise<Metadata> {
  const t = getDictionary(await resolveLocale(params)).blog;
  return { title: t.title, description: t.subtitle };
}

export default async function BlogIndex({ params }: PageProps<"/[lang]/blog">) {
  return <PostIndexPage lang={await resolveLocale(params)} type="BLOG" />;
}
