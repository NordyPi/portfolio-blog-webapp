import type { Metadata } from "next";
import { PostIndexPage } from "@/components/post-pages";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/portfolio">): Promise<Metadata> {
  const t = getDictionary(await resolveLocale(params)).portfolio;
  return { title: t.title, description: t.subtitle };
}

export default async function PortfolioIndex({ params }: PageProps<"/[lang]/portfolio">) {
  return <PostIndexPage lang={await resolveLocale(params)} type="PROJECT" />;
}
