"use client";

import * as React from "react";
import {
  CampaignHero,
  staticHero,
} from "@/features/marketing/components/home/campaign-hero";
import type { HomeCampaign } from "@/features/marketing/home-content";
import { sanitizeInline } from "@/features/admin/components/editable-text";
import type { HeroField } from "../canvas-model";

/** Эх цонх ↔ iframe мессеж. */
export const HERO_PREVIEW_MESSAGE = "vonscent:hero-preview";
export const HERO_PREVIEW_SIZE = "vonscent:hero-preview-size";
/** iframe → эх: засагдаж буй талбарын шинэ утга. */
export const HERO_PREVIEW_EDIT = "vonscent:hero-preview-edit";
/** iframe → эх: аль талбар засагдаж байна (null = аль нь ч биш). */
export const HERO_PREVIEW_FOCUS = "vonscent:hero-preview-focus";

/** Засварын горимын тохиргоо (studio-ux.md §6.3). */
export interface HeroFrameEdit {
  /** Энэ харагдацад засагдах талбарууд. */
  fields: HeroField[];
  /** Жинхэнэ утга (орлуулагч биш) — Esc үүн рүү буцаана. */
  values: Record<HeroField, string>;
  max: Record<HeroField, number>;
  labels: Record<HeroField, string>;
  placeholders: HeroField[];
  invalid: HeroField[];
  /** Эх цонхны scale — шошго, хүрээ дэлгэцэн дээр ижил хэмжээтэй. */
  scale: number;
}

interface FrameMessage {
  type?: string;
  campaign?: HomeCampaign;
  edit?: HeroFrameEdit | null;
}

/** `campaign` дахь тухайн талбарын текстийг солино. */
function withText(c: HomeCampaign, f: HeroField, text: string): HomeCampaign {
  switch (f) {
    case "primary":
      return { ...c, primary: { ...c.primary, label: text } };
    case "secondary":
      return c.secondary
        ? { ...c, secondary: { ...c.secondary, label: text } }
        : c;
    case "mobileDescription":
      return { ...c, mobileDescription: text };
    default:
      return { ...c, [f]: text };
  }
}

function textOf(c: HomeCampaign, f: HeroField): string {
  switch (f) {
    case "primary":
      return c.primary.label;
    case "secondary":
      return c.secondary?.label ?? "";
    case "mobileDescription":
      return c.mobileDescription ?? c.description;
    default:
      return c[f];
  }
}

function fieldOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-hero-field][contenteditable]")
    : null;
}

function setEditable(el: HTMLElement) {
  if (el.isContentEditable) return;
  try {
    el.contentEditable = "plaintext-only";
  } catch {
    // Firefox-ийн хуучин хувилбар — paste-ийг доор өөрсдөө цэвэрлэнэ.
    el.contentEditable = "true";
  }
}

const caretToEnd = (el: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

/** Засварын горимын хүрээ, шошго (scale-д үл хамааран дэлгэцэн дээр ~11px). */
const EDIT_CSS = `
[data-hero-editing] [data-hero-field][contenteditable] {
  position: relative; cursor: text; border-radius: 2px;
  outline: 0 solid transparent; outline-offset: calc(4px / var(--s));
}
[data-hero-editing] a:has([contenteditable]) { cursor: text; }
/* Хоосон inline талбар өргөнгүй болбол caret тавигдахгүй, бичвэр орохгүй. */
[data-hero-editing] [data-hero-field][contenteditable]:empty {
  display: inline-block; min-width: 1ch; min-height: 1lh;
}
[data-hero-editing] [data-hero-field][contenteditable]:hover {
  outline: calc(1px / var(--s)) solid var(--cta);
}
[data-hero-editing] [data-hero-field][contenteditable]:focus {
  outline: calc(2px / var(--s)) solid var(--cta);
}
[data-hero-editing] [data-hero-placeholder]:not(:focus) { opacity: 0.55; }
[data-hero-editing] [data-hero-invalid]:not(:focus) {
  outline: calc(2px / var(--s)) solid var(--destructive);
}
[data-hero-editing] [data-hero-field][contenteditable]:hover::before,
[data-hero-editing] [data-hero-field][contenteditable]:focus::before {
  content: attr(data-hero-label);
  position: absolute; left: 0; bottom: 100%;
  margin-bottom: calc(6px / var(--s));
  padding: 0 calc(4px / var(--s));
  border-radius: calc(2px / var(--s));
  background: var(--cta); color: var(--cta-foreground);
  font: 500 calc(11px / var(--s)) / 1.5 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: normal; text-transform: none; white-space: nowrap;
  pointer-events: none; opacity: 1;
}
`;

/**
 * iframe доторх hero. `campaign` ирэхэд зурж, өндөр болон гарчгийн мөрийн
 * тоог эх цонх руу буцаана (desktop-д 2 мөрөөс хэтэрвэл анхааруулга).
 * Зөвхөн ижил origin-оос ирсэн мессежийг хүлээж авна.
 *
 * `edit` ирвэл засварын горим (studio-ux.md §6.3): `[data-hero-field]`
 * элементүүд `contenteditable`, hover дээр хүрээ + шошго; бичих бүрт утгыг
 * эх цонх руу илгээнэ. Засагдаж буй талбарыг React дахин бичихгүй («хөлдөөнө»)
 * — caret үсрэхгүй; blur дээр суллана. Холбоос засварын үед шилжихгүй.
 */
export function HeroPreviewFrame() {
  const [campaign, setCampaign] = React.useState<HomeCampaign | null>(null);
  const [edit, setEdit] = React.useState<HeroFrameEdit | null>(null);
  /** Засагдаж буй талбар ба focus-ийн мөчид зурагдсан текст. */
  const [frozen, setFrozen] = React.useState<{
    field: HeroField;
    text: string;
  } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const editRef = React.useRef(edit);
  const campaignRef = React.useRef(campaign);
  const frozenRef = React.useRef(frozen);
  /** Esc-ийн буцах утга. */
  const before = React.useRef("");

  React.useEffect(() => {
    editRef.current = edit;
    campaignRef.current = campaign;
    frozenRef.current = frozen;
  });

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as FrameMessage;
      if (data?.type === HERO_PREVIEW_MESSAGE && data.campaign) {
        setCampaign(data.campaign);
        setEdit(data.edit ?? null);
      }
    }
    window.addEventListener("message", onMessage);
    // Бэлэн болсныг мэдэгдэнэ — эх цонх эхний өгөгдлөө илгээнэ.
    window.parent.postMessage(
      { type: HERO_PREVIEW_SIZE, ready: true },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const title = el.querySelector<HTMLElement>("#home-hero-title");
      const lineHeight = title
        ? parseFloat(getComputedStyle(title).lineHeight) || 1
        : 1;
      window.parent.postMessage(
        {
          type: HERO_PREVIEW_SIZE,
          height: Math.ceil(el.getBoundingClientRect().height),
          titleLines: title ? Math.round(title.offsetHeight / lineHeight) : 0,
        },
        window.location.origin,
      );
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [campaign]);

  // Талбаруудыг засагддаг болгох / буцаах — render бүрийн дараа.
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-hero-field]")) {
      const f = el.dataset.heroField as HeroField;
      if (edit?.fields.includes(f)) {
        setEditable(el);
        el.spellcheck = false;
        el.setAttribute("role", "textbox");
        el.setAttribute("aria-label", edit.labels[f]);
        el.dataset.heroLabel = edit.labels[f];
        el.toggleAttribute("data-hero-placeholder", edit.placeholders.includes(f));
        el.toggleAttribute("data-hero-invalid", edit.invalid.includes(f));
      } else {
        el.removeAttribute("contenteditable");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
      }
    }
  });

  // Засварын үйлдлүүд — hero анх зурагдмагц нэг удаа, хамгийн сүүлийн утгыг ref-ээс.
  const ready = campaign !== null;
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const post = (msg: object) =>
      window.parent.postMessage(msg, window.location.origin);
    const maxOf = (f: HeroField) => editRef.current?.max[f] ?? 0;
    const selectedLength = () => window.getSelection()?.toString().length ?? 0;

    function onClick(e: MouseEvent) {
      if (!editRef.current) return;
      if (e.target instanceof Element && e.target.closest("a")) {
        e.preventDefault();
      }
    }
    function onFocusIn(e: FocusEvent) {
      const el = fieldOf(e.target);
      const c = campaignRef.current;
      const ed = editRef.current;
      if (!el || !c || !ed) return;
      const f = el.dataset.heroField as HeroField;
      before.current = ed.values[f];
      setFrozen({ field: f, text: textOf(c, f) });
      if (ed.placeholders.includes(f)) {
        el.textContent = ed.values[f];
        caretToEnd(el);
        // focus-ийн дараах render сонголтыг алдуулж болно — дахин тавина.
        requestAnimationFrame(() => {
          if (document.activeElement === el) caretToEnd(el);
        });
      }
      post({ type: HERO_PREVIEW_FOCUS, field: f });
    }
    function onFocusOut(e: FocusEvent) {
      const el = fieldOf(e.target);
      const fr = frozenRef.current;
      if (!el || !fr) return;
      // React нь энэ элементэд зурсан гэж бодож буй текстийг сэргээнэ — шинэ
      // утга ирэхэд React өөрөө сольно (утга өөрчлөгдөөгүй бол ч зөв үлдэнэ).
      el.textContent = fr.text;
      setFrozen(null);
      post({ type: HERO_PREVIEW_FOCUS, field: null });
    }
    function onBeforeInput(e: InputEvent) {
      const el = fieldOf(e.target);
      if (!el) return;
      if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
        e.preventDefault();
        el.blur();
        return;
      }
      // Caret талбараас гадуур (хоосолсон орлуулагч г.м.) бол төгсгөлд нь.
      const anchor = window.getSelection()?.anchorNode ?? null;
      if (!anchor || !el.contains(anchor)) caretToEnd(el);
      if (e.inputType.startsWith("insert") && e.data && !e.isComposing) {
        const f = el.dataset.heroField as HeroField;
        const len = (el.textContent ?? "").length - selectedLength() + e.data.length;
        if (len > maxOf(f)) e.preventDefault();
      }
    }
    function onInput(e: Event) {
      const el = fieldOf(e.target);
      if (!el) return;
      const f = el.dataset.heroField as HeroField;
      const raw = el.textContent ?? "";
      const value = sanitizeInline(raw, maxOf(f));
      // IME-ээр хязгаар давсан г.м. — тайрч, caret-ыг төгсгөлд.
      if (value !== raw) {
        el.textContent = value;
        caretToEnd(el);
      }
      post({ type: HERO_PREVIEW_EDIT, field: f, value });
    }
    function onKeyDown(e: KeyboardEvent) {
      const el = fieldOf(e.target);
      if (!el || e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        const f = el.dataset.heroField as HeroField;
        post({ type: HERO_PREVIEW_EDIT, field: f, value: before.current });
        el.blur();
      }
    }
    function onPaste(e: ClipboardEvent) {
      const el = fieldOf(e.target);
      if (!el) return;
      e.preventDefault();
      const f = el.dataset.heroField as HeroField;
      const room = maxOf(f) - ((el.textContent ?? "").length - selectedLength());
      const text = sanitizeInline(e.clipboardData?.getData("text/plain") ?? "", Math.max(0, room));
      // Форматгүй текст — caret-ын байранд (undo-д ч орно).
      if (text) document.execCommand("insertText", false, text);
    }

    root.addEventListener("click", onClick, true);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("paste", onPaste);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("paste", onPaste);
    };
  }, [ready]);

  if (!campaign || campaign.image.kind !== "static") return null;
  const shown = frozen ? withText(campaign, frozen.field, frozen.text) : campaign;
  return (
    <div
      ref={ref}
      data-hero-editing={edit ? "" : undefined}
      style={edit ? ({ "--s": edit.scale } as React.CSSProperties) : undefined}
      className="bg-background p-4 md:px-8"
    >
      {edit && <style>{EDIT_CSS}</style>}
      <CampaignHero hero={staticHero(shown, campaign.image)} />
    </div>
  );
}
