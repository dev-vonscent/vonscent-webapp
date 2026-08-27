"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  AddressDialog,
  type AddressFormValue,
} from "@/features/account/components/address-dialog";
import { composeDetail } from "@/features/checkout/components/address-fields";
import { createClient } from "@/lib/supabase/browser";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { AddressRow } from "@/db/types";

/** Үндсэн хаяг үргэлж хамгийн дээр — жагсаалтын дараалал нэг эх сурвалжтай. */
function sortDefaultFirst(list: AddressRow[]): AddressRow[] {
  return [...list].sort((a, b) => Number(b.is_default) - Number(a.is_default));
}

export function AddressBook() {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<AddressRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );
  /** Сервер рүү явж буй "үндсэн болгох" хүсэлтийн хаягийн id. */
  const [savingId, setSavingId] = React.useState<string | null>(null);
  /** Дөнгөж үндсэн болсон карт — нэг удаагийн highlight-д. */
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const reduced = usePrefersReducedMotion();

  const load = React.useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoaded(true);
      return;
    }
    setUserId(user.id);
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setItems(sortDefaultFirst((data as AddressRow[] | null) ?? []));
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add(form: AddressFormValue) {
    const supabase = createClient();
    if (!supabase || !userId) return;
    await supabase.from("addresses").insert({
      user_id: userId,
      label: form.district || form.city,
      recipient: form.recipient,
      phone: form.phone,
      city: form.city,
      district: form.district || null,
      detail: composeDetail(form.khoroo, form.detail),
      is_default: items.length === 0,
    });
    load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("addresses").delete().eq("id", id);
    load();
  }

  async function makeDefault(id: string) {
    const supabase = createClient();
    if (!supabase || !userId || savingId) return;

    // Optimistic: карт шууд дээшээ шилжиж, badge нь тэр дор нь гарна.
    // Алдаа гарвал өмнөх төлөв рүү буцаана.
    const previous = items;
    setSavingId(id);
    setItems(
      sortDefaultFirst(items.map((a) => ({ ...a, is_default: a.id === id }))),
    );

    const cleared = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
    const set = cleared.error
      ? cleared
      : await supabase
          .from("addresses")
          .update({ is_default: true })
          .eq("id", id);

    setSavingId(null);

    if (cleared.error || set.error) {
      setItems(previous);
      toast.error("Үндсэн хаяг солиход алдаа гарлаа.");
      return;
    }

    setFlashId(id);
    window.setTimeout(
      () => setFlashId((cur) => (cur === id ? null : cur)),
      900,
    );
    toast.success("Үндсэн хаяг солигдлоо.");
  }

  return (
    <section className="space-y-2">
      {/* Хэсгийн гарчиг — мөрийн card биш, тул доорх жагсаалтын толгой нь
          болох нь тодорхой (энэ нь шилжих линк биш). */}
      <div className="flex items-center gap-3 px-1 pt-2">
        <h2 className="font-serif text-lg font-semibold">Хүргэлтийн хаягууд</h2>
        {items.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {items.length} хаяг
          </span>
        )}
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" /> Нэмэх
          </Button>
        )}
      </div>

      {loaded && items.length === 0 && (
        <div className="bg-secondary flex flex-col items-center gap-3 rounded-xl py-12 text-center">
          <MapPin className="text-muted-foreground size-9" />
          <p className="text-muted-foreground text-sm">Хадгалсан хаяг алга.</p>
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Шинэ хаяг нэмэх
          </Button>
        </div>
      )}

      {items.length > 0 && (
        // Дараалал өөрчлөгдөхөд карт нь үсэрч солигдохгүй, гулсаж байрлана.
        <MotionConfig
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 34 }
          }
        >
          <motion.div layout className="space-y-2">
            <AnimatePresence initial={false}>
              {items.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                >
                  <Card
                    className={cn(
                      "transition-shadow duration-300",
                      a.is_default && "ring-foreground/25 ring-1",
                      flashId === a.id && "ring-gold-strong/60 ring-2",
                    )}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{a.recipient}</p>
                            <AnimatePresence initial={false}>
                              {a.is_default && (
                                <motion.span
                                  key="default-badge"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                >
                                  <Badge variant="new">Үндсэн хаяг</Badge>
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {a.phone}
                          </p>
                          <p className="mt-1 text-sm">
                            {a.city}
                            {a.district ? `, ${a.district}` : ""}, {a.detail}
                          </p>
                        </div>

                        <button
                          onClick={() => setPendingDeleteId(a.id)}
                          className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-2"
                          aria-label="Устгах"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Дарах газар нь тодорхой байх ёстой — icon биш, бичигтэй товч. */}
                      {!a.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={savingId !== null}
                          aria-busy={savingId === a.id}
                          onClick={() => makeDefault(a.id)}
                        >
                          {savingId === a.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Солиж
                              байна…
                            </>
                          ) : (
                            <>
                              <Check className="size-4" /> Үндсэн хаяг болгох
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </MotionConfig>
      )}

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={add}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Хаягаа устгах уу?"
        description="Энэ үйлдлийг буцаах боломжгүй."
        confirmLabel="Устгах"
        destructive
        onConfirm={async () => {
          if (pendingDeleteId) await remove(pendingDeleteId);
        }}
      />
    </section>
  );
}
