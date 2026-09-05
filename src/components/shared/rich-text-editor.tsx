"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { xhrUpload, uploadErrorMessage } from "@/lib/storage/upload-progress";

/** Явцтай байршуулалт — toolbar-ын доор нэг мөр бар. */
interface UploadState {
  label: string;
  /** 0–100; null = серверт хүрсэн, боловсруулж байна. */
  pct: number | null;
}

/**
 * TipTap WYSIWYG for admin content (blog body, FAQ answers, about story).
 * Value is an HTML string; the public side renders it through <RichText>
 * (sanitized). Legacy plain-text values are loaded as-is — TipTap turns
 * them into paragraphs on first save.
 */

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [uploading, setUploading] = React.useState<UploadState | null>(null);

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Холбоосын URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function addImage(file: File) {
    // Same downscale the admin pickers do — a raw camera file is over the
    // host's request-body limit and would fail with an opaque platform error.
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      toast.error(prepared.message);
      return;
    }
    const form = new FormData();
    form.append("file", prepared.file);
    form.append("folder", "blog");
    setUploading({ label: "Зураг байршуулж байна", pct: 0 });
    try {
      const res = await xhrUpload<{
        url?: string;
        error?: string;
        demo?: boolean;
      }>({
        url: "/api/admin/upload",
        body: form,
        onProgress: (pct) =>
          setUploading({
            label: "Зураг байршуулж байна",
            pct: pct < 100 ? pct : null,
          }),
      });
      if (res.status < 200 || res.status >= 300 || !res.json?.url) {
        toast.error(uploadErrorMessage(res, "Зураг байршуулж чадсангүй"));
        return;
      }
      editor.chain().focus().setImage({ src: res.json.url }).run();
    } catch {
      toast.error("Сүлжээний алдаа — дахин оролдоно уу.");
    } finally {
      setUploading(null);
    }
  }

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="border-border flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <ToolbarButton
        label="Тод"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Налуу"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Гарчиг H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Гарчиг H3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Жагсаалт"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Дугаарласан жагсаалт"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Ишлэл"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Холбоос"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <LinkIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Зураг оруулах"
        disabled={uploading !== null}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon className="size-4" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addImage(file);
          e.target.value = "";
        }}
      />
      <span className="mx-1 grow" />
      <ToolbarButton
        label="Буцаах"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Давтах"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="size-4" />
      </ToolbarButton>
      {uploading && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uploading.pct ?? undefined}
          aria-label={uploading.label}
          className="text-muted-foreground flex w-full items-center gap-2 px-1 pt-1 text-xs"
        >
          <span className="bg-border h-1 flex-1 overflow-hidden rounded-full">
            <span
              className={cn(
                "bg-foreground block h-full transition-[width] duration-150",
                uploading.pct === null && "animate-pulse",
              )}
              style={{ width: `${uploading.pct ?? 100}%` }}
            />
          </span>
          <span className="tabular-nums">
            {uploading.pct === null
              ? "Боловсруулж байна…"
              : `${uploading.label}… ${uploading.pct}%`}
          </span>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Агуулга…" }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-32 px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? "" : e.getHTML());
    },
  });

  // Clearing the form after a submit resets the editor too.
  React.useEffect(() => {
    if (editor && value === "" && !editor.isEmpty) {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn(
          "bg-secondary min-h-42 animate-pulse rounded-md",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("bg-secondary rounded-md", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
