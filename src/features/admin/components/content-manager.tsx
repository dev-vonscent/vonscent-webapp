"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { DatePicker } from "@/features/admin/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { ImageUpload } from "@/features/admin/components/image-upload";
import type {
  PopupSettings,
  PopupSlide,
  SocialSettings,
  AboutSettings,
} from "@/features/content/api";
import type { FaqRow, BlogPostRow } from "@/db/types";
import { toast } from "@/lib/toast";
import { mutate, saveSetting } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";

export function ContentManager({
  popup,
  social,
  faqs,
  posts,
  about,
}: {
  popup: PopupSettings;
  social: SocialSettings;
  faqs: FaqRow[];
  posts: BlogPostRow[];
  about: AboutSettings;
}) {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Контент удирдах</h1>
      <PopupSection initial={popup} />
      <SocialSection initial={social} />
      <FaqSection initial={faqs} />
      <BlogSection initial={posts} />
      <AboutSection initial={about} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function PopupSection({ initial }: { initial: PopupSettings }) {
  const [confirm, confirmDialog] = useConfirm();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [frequency, setFrequency] = React.useState(initial.frequencyHours);
  const [slides, setSlides] = React.useState<PopupSlide[]>(
    initial.slides ?? [],
  );
  const [busy, setBusy] = React.useState(false);

  function setSlide(i: number, patch: Partial<PopupSlide>) {
    setSlides((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function addSlide() {
    setSlides((ss) => [
      ...ss,
      {
        title: "",
        body: "",
        ctaLabel: "",
        ctaHref: "/catalog",
        imageUrl: null,
        startsAt: null,
        endsAt: null,
      },
    ]);
  }
  async function removeSlide(i: number) {
    if (
      !(await confirm({
        title: `Слайд ${i + 1}-ийг устгах уу?`,
        description:
          "Слайдын гарчиг, зураг, холбоос устна. Хадгалсны дараа сайтад харагдахаа болино.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    setSlides((ss) => ss.filter((_, j) => j !== i));
  }
  async function save() {
    setBusy(true);
    try {
      const ok = await saveSetting(
        "popup",
        { enabled, frequencyHours: frequency, slides },
        "Popup хадгалагдсангүй",
      );
      if (ok) toast.success("Popup хадгалагдлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Сурталчилгааны popup (олон слайд, swipe + autoplay)">
      {confirmDialog}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => setEnabled(Boolean(v))}
          />
          Идэвхжүүлэх
        </label>
        <Field label="Давтамж (цаг)">
          <Input
            type="number"
            className="w-28"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value) || 24)}
          />
        </Field>
      </div>

      <div className="space-y-4">
        {slides.map((s, i) => (
          <div key={i} className="bg-muted/40 space-y-3 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Слайд {i + 1}</p>
              <button
                type="button"
                onClick={() => removeSlide(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Слайд ${i + 1} устгах`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Гарчиг">
                <Input
                  value={s.title}
                  onChange={(e) => setSlide(i, { title: e.target.value })}
                />
              </Field>
              <Field label="Зураг">
                <ImageUpload
                  value={s.imageUrl}
                  onChange={(url) => setSlide(i, { imageUrl: url })}
                />
              </Field>
              <Field label="CTA текст">
                <Input
                  value={s.ctaLabel}
                  onChange={(e) => setSlide(i, { ctaLabel: e.target.value })}
                />
              </Field>
              <Field label="CTA холбоос">
                <Input
                  value={s.ctaHref}
                  onChange={(e) => setSlide(i, { ctaHref: e.target.value })}
                />
              </Field>
              <Field label="Эхлэх огноо">
                <DatePicker
                  value={s.startsAt ? s.startsAt.slice(0, 10) : ""}
                  placeholder="Хязгааргүй"
                  onChange={(v) =>
                    setSlide(i, {
                      startsAt: v ? new Date(v).toISOString() : null,
                    })
                  }
                />
              </Field>
              <Field label="Дуусах огноо">
                <DatePicker
                  value={s.endsAt ? s.endsAt.slice(0, 10) : ""}
                  placeholder="Хязгааргүй"
                  onChange={(v) =>
                    setSlide(i, {
                      endsAt: v ? new Date(v).toISOString() : null,
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Текст">
                <Input
                  value={s.body}
                  onChange={(e) => setSlide(i, { body: e.target.value })}
                />
              </Field>
              <Field label="Купон код (заавал биш — бичвэл хуулах товчтой купон болж харагдана)">
                <Input
                  value={s.couponCode ?? ""}
                  placeholder="SUMMER10"
                  onChange={(e) =>
                    setSlide(i, {
                      couponCode:
                        e.target.value.trim().toUpperCase() || undefined,
                    })
                  }
                />
              </Field>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addSlide}>
          <Plus className="size-4" /> Слайд нэмэх
        </Button>
      </div>

      <Button onClick={save} disabled={busy}>
        {busy ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </Section>
  );
}

function SocialSection({ initial }: { initial: SocialSettings }) {
  const [s, setS] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  async function save() {
    setBusy(true);
    try {
      const ok = await saveSetting(
        "social",
        s,
        "Сошиал холбоос хадгалагдсангүй",
      );
      if (ok) toast.success("Сошиал холбоос хадгалагдлаа.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Сошиал холбоос">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Instagram URL">
          <Input
            value={s.instagram}
            onChange={(e) => setS({ ...s, instagram: e.target.value })}
          />
        </Field>
        <Field label="Facebook URL">
          <Input
            value={s.facebook}
            onChange={(e) => setS({ ...s, facebook: e.target.value })}
          />
        </Field>
        <Field label="Утас">
          <Input
            value={s.phone}
            onChange={(e) => setS({ ...s, phone: e.target.value })}
          />
        </Field>
        <Field label="Имэйл">
          <Input
            value={s.email}
            onChange={(e) => setS({ ...s, email: e.target.value })}
          />
        </Field>
      </div>
      <Button onClick={save} disabled={busy}>
        {busy ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </Section>
  );
}

function FaqSection({ initial }: { initial: FaqRow[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [category, setCategory] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  async function add() {
    if (!question || !answer) return;
    const ok = await mutate(
      "/api/admin/faqs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          question,
          answer,
          sortOrder: initial.length,
        }),
      },
      "FAQ нэмэгдсэнгүй",
    );
    if (!ok) return;
    toast.success("FAQ нэмэгдлээ.");
    setCategory("");
    setQuestion("");
    setAnswer("");
    router.refresh();
  }
  async function del(id: string, question: string) {
    if (
      !(await confirm({
        title: "Энэ FAQ-г устгах уу?",
        description: `«${question}» асуулт сайтаас алга болно. Буцаах боломжгүй.`,
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    const ok = await mutate(
      `/api/admin/faqs/${id}`,
      { method: "DELETE" },
      "FAQ устсангүй",
    );
    if (!ok) return;
    toast.success("FAQ устлаа.");
    router.refresh();
  }
  return (
    <Section title="FAQ">
      {confirmDialog}
      <ul className="space-y-2">
        {initial.map((f) => (
          <EditableRow
            key={f.id}
            summary={
              <span>
                <Badge variant="secondary" className="mr-2">
                  {f.category}
                </Badge>
                {f.question}
              </span>
            }
            onDelete={() => del(f.id, f.question)}
            fields={[
              { key: "category", label: "Ангилал", value: f.category ?? "" },
              { key: "question", label: "Асуулт", value: f.question },
              {
                key: "answer",
                label: "Хариулт",
                value: f.answer,
                richtext: true,
              },
            ]}
            onSave={async (v) => {
              const ok = await mutate(
                `/api/admin/faqs/${f.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    category: v.category,
                    question: v.question,
                    answer: v.answer,
                  }),
                },
                "FAQ хадгалагдсангүй",
              );
              if (!ok) return false;
              toast.success("FAQ хадгалагдлаа.");
              router.refresh();
              return true;
            }}
          />
        ))}
      </ul>
      <div className="grid gap-2">
        <Input
          placeholder="Ангилал"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Input
          placeholder="Асуулт"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <RichTextEditor
          placeholder="Хариулт"
          value={answer}
          onChange={setAnswer}
        />
      </div>
      <Button variant="secondary" onClick={add}>
        <Plus className="size-4" /> FAQ нэмэх
      </Button>
    </Section>
  );
}

function BlogSection({ initial }: { initial: BlogPostRow[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [body, setBody] = React.useState("");
  async function add() {
    if (!title) return;
    const ok = await mutate(
      "/api/admin/blog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          excerpt,
          body,
          isPublished: true,
        }),
      },
      "Нийтлэл нэмэгдсэнгүй",
    );
    if (!ok) return;
    toast.success("Нийтлэл нэмэгдлээ.");
    setTitle("");
    setCategory("");
    setExcerpt("");
    setBody("");
    router.refresh();
  }
  async function del(id: string, title: string) {
    if (
      !(await confirm({
        title: "Энэ нийтлэлийг устгах уу?",
        description: `«${title}» нийтлэл сайтаас алга болно. Буцаах боломжгүй.`,
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    const ok = await mutate(
      `/api/admin/blog/${id}`,
      { method: "DELETE" },
      "Нийтлэл устсангүй",
    );
    if (!ok) return;
    toast.success("Нийтлэл устлаа.");
    router.refresh();
  }
  return (
    <Section title="Блог нийтлэл">
      {confirmDialog}
      <ul className="space-y-2">
        {initial.map((p) => (
          <EditableRow
            key={p.id}
            summary={
              <span>
                <strong>{p.title}</strong>{" "}
                {!p.is_published && <Badge variant="secondary">Ноорог</Badge>}
              </span>
            }
            onDelete={() => del(p.id, p.title)}
            fields={[
              { key: "title", label: "Гарчиг", value: p.title },
              { key: "category", label: "Ангилал", value: p.category ?? "" },
              { key: "excerpt", label: "Товч", value: p.excerpt ?? "" },
              {
                key: "body",
                label: "Агуулга",
                value: p.body ?? "",
                richtext: true,
              },
            ]}
            onSave={async (v) => {
              const ok = await mutate(
                `/api/admin/blog/${p.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: v.title,
                    category: v.category,
                    excerpt: v.excerpt,
                    body: v.body,
                  }),
                },
                "Нийтлэл хадгалагдсангүй",
              );
              if (!ok) return false;
              toast.success("Нийтлэл хадгалагдлаа.");
              router.refresh();
              return true;
            }}
          />
        ))}
      </ul>
      <div className="grid gap-2">
        <Input
          placeholder="Гарчиг"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Ангилал"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Input
          placeholder="Товч (excerpt)"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
        <RichTextEditor
          placeholder="Нийтлэлийн агуулга"
          value={body}
          onChange={setBody}
        />
      </div>
      <Button variant="secondary" onClick={add}>
        <Plus className="size-4" /> Нийтлэл нэмэх
      </Button>
    </Section>
  );
}

function AboutSection({ initial }: { initial: AboutSettings }) {
  const router = useRouter();
  const [story, setStory] = React.useState(initial.story);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      const ok = await saveSetting(
        "about",
        { ...initial, story },
        "Түүх хадгалагдсангүй",
      );
      if (!ok) return;
      toast.success("Түүх хадгалагдлаа.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Бидний тухай (about хуудасны түүх)">
      <RichTextEditor
        placeholder="Дэлгүүрийн түүх…"
        value={story}
        onChange={setStory}
      />
      <Button variant="secondary" onClick={save} disabled={busy}>
        {busy ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </Section>
  );
}

interface EditableField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
  /** TipTap editor — the value is HTML rendered by <RichText> publicly. */
  richtext?: boolean;
  /** Image picker — the value is a Storage URL set by <ImageUpload>. */
  image?: boolean;
}

/**
 * One list row with an inline edit form behind the pencil — feeds the PATCH
 * routes that previously had no UI (todo №23: баннер/блог/FAQ засах).
 */
function EditableRow({
  summary,
  fields,
  onSave,
  onDelete,
}: {
  summary: React.ReactNode;
  fields: EditableField[];
  /** Resolves true when the write landed; false keeps the form open. */
  onSave: (values: Record<string, string>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );

  async function save() {
    setBusy(true);
    try {
      // Keep the form open on failure so the operator's edits survive.
      if (await onSave(values)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="bg-muted/40 rounded-md px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        {summary}
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-muted-foreground hover:text-gold-strong"
            aria-label="Засах"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Устгах"
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          {fields.map((f) =>
            f.image ? (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <ImageUpload
                  value={values[f.key] || null}
                  onChange={(url) =>
                    setValues((v) => ({ ...v, [f.key]: url ?? "" }))
                  }
                />
              </div>
            ) : f.richtext ? (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <RichTextEditor
                  value={values[f.key]}
                  onChange={(html) =>
                    setValues((v) => ({ ...v, [f.key]: html }))
                  }
                />
              </div>
            ) : f.multiline ? (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <textarea
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  rows={4}
                  className="bg-secondary field-edge w-full rounded-md px-3 py-2 text-base md:text-sm"
                />
              </div>
            ) : (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </div>
            ),
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Болих
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
