"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Plus, Eye, EyeOff, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconUpload } from "./icon-upload";
import type { ScentFamilyOption } from "@/lib/types";

/**
 * Дүрс үүсэхийг хүлээх хэмнэл ба таслах хугацаа.
 *
 * Хоёр минут байсныг найм болгов: 2026-09-13-нд «Утаат» төрлийн дүрс дөрвөн
 * минутын дараа бэлэн болсон ба UI түүнээс өмнө хүлээхээ больсон тул «зураг
 * гарсангүй» мэт харагдсан. `scent_families` дээр job-ийн төлөв хадгалдаггүй
 * тул хугацаа нь цорын ганц дохио — богино байснаас урт нь дээр.
 */
const ICON_POLL_MS = 6000;
const ICON_WAIT_MS = 8 * 60 * 1000;

/**
 * Үнэрийн төрөл CRUD. Adding a row here makes the family selectable on the
 * product form; once a product carries it, the chip appears in the catalog
 * filter. There is no hard delete: hiding (is_active=false) is the removal
 * story, so product tags survive and a family can always be brought back.
 *
 * Дүрсээ оруулаагүй бол сервер нь AI-аар үүсгээд мөрөнд нь бичнэ
 * (`/api/admin/scent-families` → `lib/ai/family-icon.ts`). Тэр ажил хүсэлтийн
 * араас (`after()`) явдаг тул энд дүрс гартал хуудсаа тогтмол сэргээж хардаг.
 *
 * Хүлээлтийн төлөв нь React-ийн state-д биш, ӨГӨГДӨЛД тулгуурладаг: «дүрсгүй
 * + саяхан үүссэн» мөр бүр хүлээгдэж байгаа гэсэн үг. Тиймээс хуудсаа сэргээх
 * (F5) эсвэл өөр компьютероос нээхэд ч эргэлдэх тэмдэг байрандаа хэвээр байна
 * — өмнө нь state алдагдаад мэт болж алга болдог байв.
 */
export function ScentFamilyManager({
  families,
  imageGenEnabled,
}: {
  families: ScentFamilyOption[];
  /** OPENAI_API_KEY тохируулагдсан эсэх — үгүй бол хүлээх зүйл алга. */
  imageGenEnabled: boolean;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  // Нэр засаж байгаа мөр (slug) ба талбарын утга.
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [iconUrl, setIconUrl] = React.useState("");

  /**
   * Одоогийн цаг. `Date.now()`-ыг render дотор дуудаж болохгүй (цэвэр биш,
   * React Compiler хориглоно) тул жагсаалт шинэчлэгдэх бүрд эффектээс уншина.
   */
  const [now, setNow] = React.useState(0);
  React.useEffect(() => setNow(Date.now()), [families]);

  /** Дүрсээ хүлээж байгаа мөрүүд (дүрсгүй + ICON_WAIT_MS дотор үүссэн). */
  const awaitingIcons = React.useMemo(() => {
    if (!imageGenEnabled || now === 0) return new Set<string>();
    return new Set(
      families
        .filter(
          (f) =>
            !f.iconUrl && now - new Date(f.createdAt).getTime() < ICON_WAIT_MS,
        )
        .map((f) => f.slug),
    );
  }, [families, imageGenEnabled, now]);

  React.useEffect(() => {
    if (awaitingIcons.size === 0) return;
    // `families` шинэчлэгдэх бүрд энэ эффект дахин ажиллана, тиймээс нэг л
    // удаагийн timeout хангалттай: refresh → шинэ prop → дараагийн timeout.
    // Хүлээх хугацаа өнгөрөхөд `awaitingIcons` өөрөө хоосорч зогсоно.
    const t = setTimeout(() => router.refresh(), ICON_POLL_MS);
    return () => clearTimeout(t);
  }, [awaitingIcons, families, router]);

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
      setMsg(
        "Дүрсийг AI үүсгэж байна (хэдэн минут орж болно) — бэлэн болмогц энд гарч ирнэ.",
      );
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

  /**
   * Нэрийг засах. Slug нь хөдлөхгүй: хаягийн мөрөнд (`?family=`) бас
   * `products.scent_families` массив дотор шууд бичигдсэн байдаг тул түүнийг
   * солих нь бүх барааны холбоосыг таслана.
   */
  async function saveLabel(f: ScentFamilyOption) {
    const label = editLabel.trim();
    setEditing(null);
    if (!label || label === f.label) return;
    await send(`/api/admin/scent-families/${f.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    });
  }

  /**
   * Бүрмөсөн устгах. Бараан дээр ашиглагдаж байвал сервер эхлээд 409 + тоог
   * буцаана — тэр тоог хэлж, хоёр дахь удаа зөвшөөрөл авсны дараа л хүчээр
   * устгана (бараа бүрээс slug нь хасагдана).
   */
  async function remove(f: ScentFamilyOption) {
    const ok = await confirm({
      title: `«${f.label}» төрлийг устгах уу?`,
      description:
        "Устгасан төрөл буцаж сэргэхгүй. Түр хасах бол нүдний тэмдгээр нуух нь хангалттай.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;

    const url = `/api/admin/scent-families/${f.slug}`;
    const res = await adminFetch<{ products?: number }>(url, {
      method: "DELETE",
    });
    if (res.ok) {
      setMsg(`«${f.label}» устлаа.`);
      router.refresh();
      return;
    }
    if (res.demo) {
      setMsg("Demo горим: Supabase холбогдсоны дараа хадгалагдана.");
      return;
    }
    if (!res.error.includes("IN_USE")) {
      setMsg(res.error);
      return;
    }

    // 409-ийн хариу дотор хэдэн бараанд ашиглагдаж байгаа тоо ирнэ.
    const inUse = res.data?.products ?? 0;
    const forced = await confirm({
      title: `«${f.label}» ${inUse} бараан дээр ашиглагдаж байна`,
      description:
        "Устгавал энэ төрөл тэдгээр бараанаас хасагдана (бараа өөрөө үлдэнэ). Үргэлжлүүлэх үү?",
      confirmLabel: "Бүгдээс хасаад устгах",
      destructive: true,
    });
    if (!forced) return;
    const done = await adminFetch<{ products?: number }>(`${url}?force=1`, {
      method: "DELETE",
    });
    if (!done.ok) {
      setMsg(done.error);
      return;
    }
    setMsg(
      `«${f.label}» устлаа — ${done.data?.products ?? 0} бараанаас хасагдлаа.`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Feedback lives above the list — at the bottom it scrolls out of view
          and a failed/demo-mode click looks like the button did nothing. */}
      {msg && (
        <p className="bg-secondary rounded-md px-4 py-3 text-sm">{msg}</p>
      )}
      <Card>
        <CardContent className="p-0">
          <ul className="[&>li:nth-child(even)]:bg-muted/40">
            {families.map((f) => (
              <li key={f.slug} className="flex items-center gap-1 px-4 py-3">
                {awaitingIcons.has(f.slug) ? (
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
                  {editing === f.slug ? (
                    // Slug биш, зөвхөн НЭР засагдана — slug нь хаяг ба
                    // барааны массив дотор шууд бичигдсэн түлхүүр.
                    <Input
                      autoFocus
                      value={editLabel}
                      aria-label={`${f.label} нэр`}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveLabel(f);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="h-8 max-w-60"
                    />
                  ) : (
                    <span className="block truncate text-sm font-medium">
                      {f.label}
                    </span>
                  )}
                  <span className="text-muted-foreground block truncate text-xs">
                    {f.slug}
                    {!f.isActive && " · нуугдсан"}
                  </span>
                </span>

                {editing === f.slug ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => saveLabel(f)}
                      aria-label="Нэр хадгалах"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(null)}
                      aria-label="Болих"
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => {
                      setEditing(f.slug);
                      setEditLabel(f.label);
                    }}
                    aria-label={`${f.label} нэрийг засах`}
                    title="Нэр засах"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => remove(f)}
                  aria-label={`${f.label} устгах`}
                  title="Бүрмөсөн устгах"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
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
