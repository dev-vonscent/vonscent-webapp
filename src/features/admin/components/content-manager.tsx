"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  PopupSettings,
  PopupSlide,
  SocialSettings,
} from "@/features/content/api";
import type { HeroBannerRow, FaqRow, BlogPostRow } from "@/db/types";

async function saveSetting(key: string, value: unknown) {
  await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export function ContentManager({
  popup,
  social,
  banners,
  faqs,
  posts,
}: {
  popup: PopupSettings;
  social: SocialSettings;
  banners: HeroBannerRow[];
  faqs: FaqRow[];
  posts: BlogPostRow[];
}) {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Контент удирдах</h1>
      <PopupSection initial={popup} />
      <SocialSection initial={social} />
      <BannerSection initial={banners} />
      <FaqSection initial={faqs} />
      <BlogSection initial={posts} />
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
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [frequency, setFrequency] = React.useState(initial.frequencyHours);
  const [slides, setSlides] = React.useState<PopupSlide[]>(
    initial.slides ?? [],
  );
  const [saved, setSaved] = React.useState(false);

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
  async function save() {
    await saveSetting("popup", { enabled, frequencyHours: frequency, slides });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Section title="Сурталчилгааны popup (олон слайд, swipe + autoplay)">
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
          <div
            key={i}
            className="border-border space-y-3 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Слайд {i + 1}</p>
              <button
                onClick={() => setSlides((ss) => ss.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
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
              <Field label="Зургийн URL">
                <Input
                  value={s.imageUrl ?? ""}
                  onChange={(e) =>
                    setSlide(i, { imageUrl: e.target.value || null })
                  }
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
                <Input
                  type="date"
                  value={s.startsAt ? s.startsAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    setSlide(i, {
                      startsAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="Дуусах огноо">
                <Input
                  type="date"
                  value={s.endsAt ? s.endsAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    setSlide(i, {
                      endsAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Текст">
              <Input
                value={s.body}
                onChange={(e) => setSlide(i, { body: e.target.value })}
              />
            </Field>
          </div>
        ))}
        <Button variant="outline" onClick={addSlide}>
          <Plus className="size-4" /> Слайд нэмэх
        </Button>
      </div>

      <Button onClick={save}>{saved ? "Хадгалагдлаа ✓" : "Хадгалах"}</Button>
    </Section>
  );
}

function SocialSection({ initial }: { initial: SocialSettings }) {
  const [s, setS] = React.useState(initial);
  const [saved, setSaved] = React.useState(false);
  async function save() {
    await saveSetting("social", s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
      <Button onClick={save}>{saved ? "Хадгалагдлаа ✓" : "Хадгалах"}</Button>
    </Section>
  );
}

function BannerSection({ initial }: { initial: HeroBannerRow[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  async function add() {
    if (!title) return;
    await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subtitle, sortOrder: initial.length }),
    });
    setTitle("");
    setSubtitle("");
    router.refresh();
  }
  async function del(id: string) {
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <Section title="Hero баннер">
      <ul className="space-y-2">
        {initial.map((b) => (
          <li
            key={b.id}
            className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span>
              <strong>{b.title}</strong>{" "}
              <span className="text-muted-foreground">{b.subtitle}</span>
            </span>
            <button
              onClick={() => del(b.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Гарчиг"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Дэд гарчиг"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
      </div>
      <Button variant="outline" onClick={add}>
        <Plus className="size-4" /> Баннер нэмэх
      </Button>
    </Section>
  );
}

function FaqSection({ initial }: { initial: FaqRow[] }) {
  const router = useRouter();
  const [category, setCategory] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  async function add() {
    if (!question || !answer) return;
    await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        question,
        answer,
        sortOrder: initial.length,
      }),
    });
    setCategory("");
    setQuestion("");
    setAnswer("");
    router.refresh();
  }
  async function del(id: string) {
    await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <Section title="FAQ">
      <ul className="space-y-2">
        {initial.map((f) => (
          <li
            key={f.id}
            className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span>
              <Badge variant="secondary" className="mr-2">
                {f.category}
              </Badge>
              {f.question}
            </span>
            <button
              onClick={() => del(f.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
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
        <Input
          placeholder="Хариулт"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>
      <Button variant="outline" onClick={add}>
        <Plus className="size-4" /> FAQ нэмэх
      </Button>
    </Section>
  );
}

function BlogSection({ initial }: { initial: BlogPostRow[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [body, setBody] = React.useState("");
  async function add() {
    if (!title) return;
    await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        excerpt,
        body,
        isPublished: true,
      }),
    });
    setTitle("");
    setCategory("");
    setExcerpt("");
    setBody("");
    router.refresh();
  }
  async function del(id: string) {
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <Section title="Блог нийтлэл">
      <ul className="space-y-2">
        {initial.map((p) => (
          <li
            key={p.id}
            className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span>
              <strong>{p.title}</strong>{" "}
              {!p.is_published && <Badge variant="secondary">Ноорог</Badge>}
            </span>
            <button
              onClick={() => del(p.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
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
        <textarea
          placeholder="Нийтлэлийн агуулга (мөр хооронд хоосон мөр үлдээж догол хуваана)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="bg-secondary focus-visible:ring-ring w-full rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <Button variant="outline" onClick={add}>
        <Plus className="size-4" /> Нийтлэл нэмэх
      </Button>
    </Section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
