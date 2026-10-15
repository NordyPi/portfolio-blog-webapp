import { MediaImage, MediaPlaceholder } from "@/components/media-image";
import { localize, type Block } from "@/lib/blocks";
import type { Locale } from "@/lib/i18n";
import type { MediaView } from "@/lib/media";

type Media = Record<string, MediaView>;

/** Renders a post's blocks. Rich text was sanitized when saved (src/lib/rich-text.ts). */
export function BlockRenderer({ blocks, media, lang }: { blocks: Block[]; media: Media; lang: Locale }) {
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {blocks.map((block, i) => (
        <BlockView key={block.id} block={block} media={media} lang={lang} priority={i === 0} />
      ))}
    </div>
  );
}

function Caption({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return <figcaption className={`mt-3 text-center text-sm text-muted ${className ?? ""}`}>{text}</figcaption>;
}

function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={`rich-text ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Img({ id, media, sizes, className, priority }: { id: string | null; media: Media; sizes: string; className: string; priority?: boolean }) {
  const m = id ? media[id] : undefined;
  return m ? <MediaImage media={m} sizes={sizes} className={className} priority={priority} /> : <MediaPlaceholder className={className} />;
}

function BlockView({ block, media, lang, priority }: { block: Block; media: Media; lang: Locale; priority: boolean }) {
  switch (block.type) {
    case "cover":
      return (
        <figure className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Img
            id={block.mediaId}
            media={media}
            sizes="(min-width: 1152px) 1152px, 100vw"
            priority={priority}
            className="aspect-[4/3] w-full rounded-3xl object-cover sm:aspect-[16/9]"
          />
          <Caption text={localize(block.caption, lang)} />
        </figure>
      );

    case "wide":
      return (
        <figure className="w-full">
          <Img id={block.mediaId} media={media} sizes="100vw" priority={priority} className="h-56 w-full object-cover sm:h-72 lg:h-80" />
          <Caption text={localize(block.caption, lang)} className="px-4" />
        </figure>
      );

    case "split": {
      const imageFirst = block.imageSide === "left";
      return (
        <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 sm:px-6 md:grid-cols-2 md:gap-12">
          <div className={imageFirst ? "" : "md:order-2"}>
            <Img id={block.mediaId} media={media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/5] w-full rounded-2xl object-cover" />
          </div>
          <RichText html={localize(block.text, lang)} />
        </section>
      );
    }

    case "triple":
      return (
        <figure className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {block.mediaIds.map((id, i) => (
              <Img key={i} id={id} media={media} sizes="(min-width: 896px) 300px, 33vw" className="aspect-[9/16] w-full rounded-xl object-cover" />
            ))}
          </div>
          <Caption text={localize(block.caption, lang)} />
        </figure>
      );

    case "text":
      return <RichText html={localize(block.text, lang)} className="mx-auto w-full max-w-2xl px-4 sm:px-6" />;

    case "video": {
      const caption = localize(block.caption, lang);
      if (block.source.kind === "youtube") {
        if (!block.source.videoId) return null;
        return (
          <figure className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${block.source.videoId}`}
              title={caption || "YouTube video"}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full rounded-2xl"
            />
            <Caption text={caption} />
          </figure>
        );
      }
      const video = block.source.mediaId ? media[block.source.mediaId] : undefined;
      if (!video) return null;
      const portrait = (video.height ?? 0) > (video.width ?? 0);
      return (
        <figure className={`mx-auto w-full px-4 sm:px-6 ${portrait ? "max-w-sm" : "max-w-4xl"}`}>
          <video
            src={video.src}
            poster={video.poster ?? undefined}
            width={video.width ?? undefined}
            height={video.height ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-2xl bg-black"
          />
          <Caption text={caption} />
        </figure>
      );
    }
  }
}
