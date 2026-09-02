"use client";

import * as React from "react";
import { BellOff, Loader2, Mail, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";

/**
 * Имэйл мэдэгдлийн тохиргоо — хэрэглэгч өөрийн бүртгэлээ ЭНД харж, солиж,
 * цуцалдаг. Өмнө нь бүртгүүлэх нь зөвхөн footer-ийн формоор явдаг байсан тул
 * нэг л удаа бичээд буцаж өөрчлөх арга байхгүй байв.
 *
 * Данс дээрх имэйл нь `newsletter_subscribers` — Supabase auth-ийн
 * `<утас>@phone.vonscent.mn` синтетик хаяг БИШ — тэр нь зөвхөн дотоод хэрэгцээ.
 */
export function EmailSettings({
  onEmailChange,
}: {
  /** Профайлын толгойд харагдах хаягийг эцэг компонент шинэчилнэ. */
  onEmailChange?: (email: string | null) => void;
}) {
  const [email, setEmail] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState(false);

  // Callback-ийг ref-д барина: эцэг компонент дахин render хийх бүрд шинэ
  // функц дамжуулдаг тул dependency-д шууд тавьбал fetch давтагдана.
  const notify = React.useRef(onEmailChange);
  React.useEffect(() => {
    notify.current = onEmailChange;
  }, [onEmailChange]);

  React.useEffect(() => {
    fetch("/api/newsletter/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null; isActive?: boolean } | null) => {
        setEmail(data?.email ?? null);
        setIsActive(Boolean(data?.isActive));
        notify.current?.(data?.email ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function save(value: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (res.status === 409) {
        toast.error("Энэ хаяг өөр бүртгэлд холбогдсон байна.");
        return;
      }
      if (!res.ok) {
        toast.error("Хадгалж чадсангүй. Дараа дахин оролдоно уу.");
        return;
      }
      const next = value.trim().toLowerCase();
      setEmail(next);
      setIsActive(true);
      setEditing(false);
      notify.current?.(next);
      toast.success(`Захиалгын мэдэгдэл ${next} рүү очно.`);
    } catch {
      toast.error("Сүлжээнд холбогдож чадсангүй.");
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    setSaving(true);
    try {
      const res = await fetch("/api/newsletter/me", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Цуцалж чадсангүй. Дараа дахин оролдоно уу.");
        return;
      }
      setIsActive(false);
      toast.success("Мэдэгдэл унтраалаа. Хүссэн үедээ эргүүлж асаана.");
    } catch {
      toast.error("Сүлжээнд холбогдож чадсангүй.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">Имэйл мэдэгдэл</h2>
              {email && !isActive && (
                <Badge variant="secondary">Унтраалттай</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {email
                ? isActive
                  ? "Захиалга баталгаажих, цуцлагдах үед энэ хаяг руу мэдэгдэнэ."
                  : "Бүртгэл хэвээр байгаа ч мэдэгдэл явахгүй байна."
                : "Захиалгын мэдэгдэл авах хаягаа бүртгүүлээгүй байна."}
            </p>
          </div>
        </div>

        {editing || !email ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void save(draft);
            }}
            className="space-y-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                required
                autoFocus={editing}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Имэйл хаяг"
                placeholder="имэйл хаяг"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : email ? (
                    "Солих"
                  ) : (
                    "Бүртгэх"
                  )}
                </Button>
                {email && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setEditing(false)}
                  >
                    Болих
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Нэг дансанд нэг хаяг. Солиход хуучин хаяг руу мэдэгдэл явахаа
              болино.
            </p>
          </form>
        ) : (
          <div className="bg-secondary flex flex-wrap items-center gap-2 rounded-md px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(email);
                setEditing(true);
              }}
            >
              <Pencil className="size-4" /> Солих
            </Button>
          </div>
        )}

        {email && !editing && (
          <div className="flex justify-end">
            {isActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={saving}
                onClick={() => setConfirmOff(true)}
              >
                <BellOff className="size-4" /> Мэдэгдэл авахаа болих
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void save(email)}
              >
                Мэдэгдлээ эргүүлж асаах
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Мэдэгдэл авахаа болих уу?"
        description="Захиалга баталгаажих, цуцлагдах үед имэйл ирэхээ болино. Хаяг чинь бүртгэлд үлдэх тул хүссэн үедээ эргүүлж асааж болно."
        confirmLabel="Болих"
        cancelLabel="Буцах"
        destructive
        onConfirm={() => void unsubscribe()}
      />
    </Card>
  );
}
