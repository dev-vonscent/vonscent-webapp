"use client";

import * as React from "react";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AddressFields,
  composeDetail,
} from "@/features/checkout/components/address-fields";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/browser";
import type { AddressRow } from "@/db/types";

const EMPTY = {
  recipient: "",
  phone: "",
  city: "",
  district: "",
  khoroo: null as number | null,
  detail: "",
};

export function AddressBook() {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<AddressRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );

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
    setItems((data as AddressRow[] | null) ?? []);
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !userId) return;
    setSaving(true);
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
    setForm(EMPTY);
    setShowForm(false);
    setSaving(false);
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
    if (!supabase || !userId) return;
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-lg font-semibold">Хүргэлтийн хаягууд</h2>

      {loaded && items.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-secondary py-12 text-center">
          <MapPin className="size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Хадгалсан хаяг алга.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.recipient}</p>
                    {a.is_default && <Badge variant="new">Үндсэн</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{a.phone}</p>
                  <p className="mt-1 text-sm">
                    {a.city}
                    {a.district ? `, ${a.district}` : ""}, {a.detail}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!a.is_default && (
                    <button
                      onClick={() => makeDefault(a.id)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Үндсэн болгох"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setPendingDeleteId(a.id)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Устгах"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={add} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Хүлээн авагч</Label>
                  <Input
                    value={form.recipient}
                    onChange={(e) =>
                      setForm({ ...form, recipient: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Утас</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>

              <AddressFields
                value={{
                  city: form.city,
                  district: form.district,
                  khoroo: form.khoroo,
                }}
                onChange={(next) =>
                  setForm({
                    ...form,
                    city: next.city,
                    district: next.district,
                    khoroo: next.khoroo,
                  })
                }
              />
              <div className="space-y-1.5">
                <Label>Дэлгэрэнгүй хаяг</Label>
                <Input
                  value={form.detail}
                  placeholder="Байр, орц, тоот"
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                >
                  Болих
                </Button>
                <Button type="submit" disabled={saving}>
                  Хадгалах
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowForm(true)}
        >
          <Plus className="size-4" /> Шинэ хаяг нэмэх
        </Button>
      )}

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
