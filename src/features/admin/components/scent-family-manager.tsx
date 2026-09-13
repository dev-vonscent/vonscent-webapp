"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/features/admin/lib/mutate";
import { Plus, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconUpload } from "./icon-upload";
import type { ScentFamilyOption } from "@/lib/types";

/**
 * Дүрс үүсэхийг хүлээх хэмнэл ба таслах хугацаа. Ердийн үүсэлт 20-60 секунд;
 * хоёр минутын дараа ч ирээгүй бол амжилтгүй болсон гэж үзнэ (`scent_families`
 * дээр job-ийн төлөв хадгалдаггүй тул хугацаа нь цорын ганц дохио).
 */
const ICON_POLL_MS = 5000;
const ICON_WAIT_MS = 2 * 60 * 1000;

/**
 * Үнэрийн төрөл CRUD. Adding a row here makes the family selectable on the
 * product form; once a product carries it, the chip appears in the catalog
 * filter. There is no hard delete: hiding (is_active=false) is the removal
 * story, so product tags survive and a family can always be brought back.
 *
 * Дүрсээ оруулаагүй бол сервер нь AI-аар үүсгээд мөрөнд нь бичнэ
 * (`/api/admin/scent-families` → `lib/ai/family-icon.ts`). Тэр ажил хүсэлтийн
 * араас (`after()`) явдаг тул энд дүрс гартал хуудсаа тогтмол сэргээж хардаг.
 */
export function ScentFamilyManager({
  families,
}: {
  families: ScentFamilyOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [iconUrl, setIconUrl] = React.useState("");
  // Аль төрлийн дүрсийг, хэдийг хүртэл хүлээж байгаа.
  const [iconWatch, setIconWatch] = React.useState<{
    slug: string;
    until: number;
  } | null>(null);

  React.useEffect(() => {
    if (!iconWatch) return;
    if (families.some((f) => f.slug === iconWatch.slug && f.iconUrl)) {
      setIconWatch(null);
      setMsg("Дүрс бэлэн боллоо.");
      return;
    }
    if (Date.now() > iconWatch.until) {
      setIconWatch(null);
      setMsg(
        "Дүрс үүсгэж чадсангүй эсвэл удаж байна — гараар оруулж болно.",
      );
      return;
    }
    // `families` шинэчлэгдэх бүрд энэ эффект дахин ажиллана, тиймээс нэг л
    // удаагийн timeout хангалттай: refresh → шинэ prop → дараагийн timeout.
    const t = setTimeout(() => router.refresh(), ICON_POLL_MS);
    return () => clearTimeout(t);
  }, [iconWatch, families, router]);

  async function send<T = unknown>(
    url: string,
    init: RequestInit,
  ): Promise<T | null> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch<T>(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!res.ok) {
        if (res.demo) {
          setMsg("Demo горим: Supabase холбогдсоны дараа хадгалагдана.");
          return null;
        }
        // The route answers with a machine code; translate the ones we know.
        const known = Object.entries({
          DUPLICATE: "Энэ slug аль хэдийн бүртгэлтэй байна.",
          NOT_MIGRATED:
            "Өгөгдлийн сан бэлэн биш байна — 0018_scent_families.sql migration ажиллуулаагүй тул доорх жагсаалт зөвхөн үндсэн утгууд. (docs/planning/todo.md B3b)",
        }).find(([code]) => res.error.includes(code));
        setMsg(known ? known[1] : res.error);
        return null;
      }
      router.refresh();
      return res.data;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const newSlug = slug.trim();
    const res = await send<{ generatingIcon?: boolean }>(
      "/api/admin/scent-families",
      {
        method: "POST",
        body: JSON.stringify({
          slug: newSlug,
          label: label.trim(),
          iconUrl: iconUrl.trim() || null,
          sortOrder: families.length + 1,
        }),
      },
    );
    if (!res) return;
    setSlug("");
    setLabel("");
    setIconUrl("");
    if (res.generatingIcon) {
      setIconWatch({ slug: newSlug, until: Date.now() + ICON_WAIT_MS });
      setMsg("Дүрсийг AI үүсгэж байна — бэлэн болмогц энд гарч ирнэ.");
    }
  }

  async function setIcon(f: ScentFamilyOption, url: string | null) {
    await send(`/api/admin/scent-families/${f.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ iconUrl: url }),
    });
  }

  async function toggleActive(f: ScentFamilyOption) {
    await send(`/api/admin/scent-families/${f.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !f.isActive }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Feedback lives above the list — at the bottom it scrolls out of view
          and a failed/demo-mode click looks like the button did nothing. */}
      {msg && (
        <p className="bg-secondary rounded-md px-4 py-3 text-sm">{msg}</p>
      )}
      <Card>
        <CardContent className="p-0">
          <ul className="[&>li:nth-child(even)]:bg-muted/40">
            {families.map((f) => (
              <li key={f.slug} className="flex items-center gap-3 px-4 py-3">
                {iconWatch?.slug === f.slug && !f.iconUrl ? (
                  // AI дүрсээ үүсгэж байгаа мөр: хоосон нүд биш, ажиллаж
                  // байгаа нь харагдана.
                  <span
                    className="border-muted-foreground/40 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed"
                    title="Дүрсийг AI үүсгэж байна"
                  >
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                ) : (
                  /* Uploading writes straight through: an icon is one field, so
                     a separate save step would only be a way to lose it. */
                  <IconUpload
                    size={36}
                    label={`${f.label} дүрс`}
                    value={f.iconUrl}
                    onChange={(url) => setIcon(f, url)}
                    allowClear={false}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {f.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {f.slug}
                    {!f.isActive && " · нуугдсан"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => toggleActive(f)}
                  aria-label={f.isActive ? "Нуух" : "Харуулах"}
                  title={
                    f.isActive
                      ? "Шүүлтүүрээс нуух (бараанууд хэвээр)"
                      : "Шүүлтүүрт буцаан харуулах"
                  }
                >
                  {f.isActive ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="text-muted-foreground size-4" />
                  )}
                </Button>
              </li>
            ))}
            {families.length === 0 && (
              <li className="text-muted-foreground px-4 py-6 text-center text-sm">
                Одоогоор үнэрийн төрөл алга.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Шинэ төрөл нэмэх</h2>
          <form onSubmit={add} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Нэр</Label>
                <Input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Гурмет"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (латинаар)</Label>
                <Input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  pattern="[a-z0-9-]+"
                  placeholder="gourmand"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Дүрс (хоосон бол AI үүсгэнэ)</Label>
                <IconUpload
                  value={iconUrl || null}
                  onChange={(url) => setIconUrl(url ?? "")}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Slug нь хаягийн мөрөнд ашиглагдана (/catalog?family=gourmand) тул
              үүсгэсний дараа өөрчлөгдөхгүй. Дүрс оруулаагүй бол AI нь slug-д
              тохирох орцны зургийг өөрөө үүсгэж хадгална (хагас минут орчим) —
              таалагдаагүй бол дээрх жагсаалтаас дараад солино.
            </p>
            <Button type="submit" disabled={busy}>
              <Plus className="mr-1 size-4" />
              Нэмэх
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
