"use client";

import { useState } from "react";
import { MediaSlot, VideoSlot } from "@/components/admin/media-slots";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { BLOCK_OPTIONS, IMAGE_RATIOS, parseYouTubeId, type Block, type Localized } from "@/lib/blocks";
import type { EditorMedia } from "@/lib/editor-types";

type Lang = "en" | "ja";

export type BlockEditorProps = {
  block: Block;
  lang: Lang;
  /** Whether `lang` is the translation (not the source) language. */
  isTranslation: boolean;
  staleKeys: string[];
  media: Record<string, EditorMedia>;
  onChange: (block: Block) => void;
  onUploaded: (m: EditorMedia) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
};

const inputClass = "w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-accent";

function blockLabel(block: Block) {
  const value =
    block.type === "split" ? `split-${block.imageSide}` : block.type === "row" ? `row-${block.mediaIds.length}` : block.type;
  return BLOCK_OPTIONS.find((o) => o.value === value)?.label ?? block.type;
}

export function TranslationBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Needs translation</span>;
}

function Caption({ value, lang, onChange, stale }: { value: Localized; lang: Lang; onChange: (v: Localized) => void; stale: boolean }) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        Caption (optional)
        <TranslationBadge show={stale} />
      </span>
      <input value={value[lang]} maxLength={300} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} className={`mt-1 ${inputClass}`} />
    </label>
  );
}

export function BlockEditor({ block, lang, isTranslation, staleKeys, media, onChange, onUploaded, onMove, onRemove, isFirst, isLast }: BlockEditorProps) {
  const stale = (field: string) => isTranslation && staleKeys.includes(`${block.id}.${field}`);
  const ctl = "rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{blockLabel(block)}</h3>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={ctl} disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move block up">
            ↑
          </button>
          <button type="button" className={ctl} disabled={isLast} onClick={() => onMove(1)} aria-label="Move block down">
            ↓
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-danger hover:bg-surface-2"
            onClick={() => window.confirm("Delete this block?") && onRemove()}
          >
            Delete
          </button>
        </div>
      </div>
      {body()}
    </section>
  );

  // A plain function (not a nested component), so editors inside keep their identity and focus across renders.
  function body() {
    const slot = { media, onUploaded };
    switch (block.type) {
      case "cover":
      case "wide":
      case "photo":
        return (
          <>
            <MediaSlot
              {...slot}
              mediaId={block.mediaId}
              onChange={(mediaId) => onChange({ ...block, mediaId })}
              ratio={block.type === "photo" ? undefined : IMAGE_RATIOS[block.type]}
            />
            <Caption value={block.caption} lang={lang} onChange={(caption) => onChange({ ...block, caption })} stale={stale("caption")} />
          </>
        );
      case "split": {
        const image = (
          <div key="image">
            <MediaSlot {...slot} mediaId={block.mediaId} onChange={(mediaId) => onChange({ ...block, mediaId })} ratio={IMAGE_RATIOS.split} />
          </div>
        );
        const text = (
          <div key="text">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Text
              <TranslationBadge show={stale("text")} />
            </span>
            <RichTextEditor
              key={`${block.id}:${lang}`}
              label="Text"
              value={block.text[lang]}
              onChange={(html) => onChange({ ...block, text: { ...block.text, [lang]: html } })}
            />
          </div>
        );
        return (
          <div className="grid gap-4 md:grid-cols-2">
            {block.imageSide === "left" ? [image, text] : [text, image]}
            <button
              type="button"
              className="text-left text-sm text-muted hover:text-accent md:col-span-2"
              onClick={() => onChange({ ...block, imageSide: block.imageSide === "left" ? "right" : "left" })}
            >
              ⇄ Swap image and text sides
            </button>
          </div>
        );
      }
      case "row":
        return (
          <>
            <div className={`grid gap-2 sm:gap-4 ${block.mediaIds.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {block.mediaIds.map((id, i) => (
                <MediaSlot
                  key={i}
                  {...slot}
                  mediaId={id}
                  ratio={IMAGE_RATIOS.row}
                  allowVideo
                  onChange={(mediaId) => {
                    const mediaIds = [...block.mediaIds];
                    mediaIds[i] = mediaId;
                    onChange({ ...block, mediaIds });
                  }}
                />
              ))}
            </div>
            <Caption value={block.caption} lang={lang} onChange={(caption) => onChange({ ...block, caption })} stale={stale("caption")} />
          </>
        );
      case "text":
        return (
          <>
            <TranslationBadge show={stale("text")} />
            <RichTextEditor
              key={`${block.id}:${lang}`}
              label="Text"
              value={block.text[lang]}
              onChange={(html) => onChange({ ...block, text: { ...block.text, [lang]: html } })}
            />
          </>
        );
      case "video":
        return (
          <>
            <div className="mb-3 flex gap-4 text-sm">
              {(["youtube", "upload"] as const).map((kind) => (
                <label key={kind} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={block.source.kind === kind}
                    onChange={() =>
                      onChange({ ...block, source: kind === "youtube" ? { kind, videoId: "" } : { kind, mediaId: null } })
                    }
                  />
                  {kind === "youtube" ? "YouTube link" : "Upload a video"}
                </label>
              ))}
            </div>
            {block.source.kind === "youtube" ? (
              <YouTubeInput videoId={block.source.videoId} onChange={(videoId) => onChange({ ...block, source: { kind: "youtube", videoId } })} />
            ) : (
              <VideoSlot
                {...slot}
                mediaId={block.source.mediaId}
                onChange={(mediaId) => onChange({ ...block, source: { kind: "upload", mediaId } })}
              />
            )}
            <Caption value={block.caption} lang={lang} onChange={(caption) => onChange({ ...block, caption })} stale={stale("caption")} />
          </>
        );
    }
  }
}

function YouTubeInput({ videoId, onChange }: { videoId: string; onChange: (id: string) => void }) {
  const [text, setText] = useState(videoId ? `https://youtu.be/${videoId}` : "");
  const parsed = parseYouTubeId(text);
  return (
    <div>
      <input
        value={text}
        placeholder="https://www.youtube.com/watch?v=…"
        onChange={(e) => {
          setText(e.target.value);
          const id = parseYouTubeId(e.target.value);
          onChange(id ?? "");
        }}
        className={inputClass}
      />
      {text && !parsed && <p className="mt-1 text-sm text-danger">That doesn&apos;t look like a YouTube link.</p>}
      {parsed && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail preview
        <img src={`https://i.ytimg.com/vi/${parsed}/hqdefault.jpg`} alt="" className="mt-3 w-64 rounded-xl" />
      )}
    </div>
  );
}
