"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

// Only formatting that the server-side sanitizer keeps (src/lib/rich-text.ts) is enabled.
const extensions = [
  StarterKit.configure({
    heading: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    underline: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
  }),
];

export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  // Tiptap keeps the onUpdate callback from its first render, so route through a ref to the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true, // keeps toolbar "active" states current
    editorProps: {
      attributes: {
        class: "rich-text min-h-36 px-4 py-3 outline-none",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface focus-within:border-accent">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded-md px-2 py-1 text-sm ${active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg"}`;

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove the link)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-border bg-surface-2/60 px-2 py-1.5">
      <button type="button" className={`${btn(editor.isActive("bold"))} font-bold`} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </button>
      <button type="button" className={`${btn(editor.isActive("italic"))} italic`} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </button>
      <button type="button" className={`${btn(editor.isActive("strike"))} line-through`} onClick={() => editor.chain().focus().toggleStrike().run()}>
        S
      </button>
      <span className="mx-1 w-px bg-border" />
      <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </button>
      <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        “ Quote
      </button>
      <button type="button" className={btn(editor.isActive("link"))} onClick={setLink}>
        Link
      </button>
    </div>
  );
}
