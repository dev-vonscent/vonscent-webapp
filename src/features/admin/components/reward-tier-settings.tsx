"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingButton } from "@/components/shared/loading-button";
import { FormDrawer } from "@/features/admin/components/form-drawer";
import { RewardTierEditor } from "@/features/admin/components/reward-tier-editor";
import {
  describeRewardLadder,
  sortRewardTiers,
} from "@/features/admin/lib/reward-tiers";
import { saveSetting } from "@/features/admin/lib/mutate";
import { useUnsavedGuard } from "@/features/admin/lib/return-to";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { couponSettingsError, type RewardTier } from "@/lib/validators/coupon";

/**
 * «Автомат» табын шатлалын тохиргоо. Хуудсан дээр зөвхөн нэг мөр хураангуй;
 * засах нь drawer дотор — тохиргоог байнга биш, ховор өөрчилдөг тул
 * купоны жагсаалтын зайг эзлэх ёсгүй (клиентийн хүсэлт).
 */
export function RewardTierSettings({ initial }: { initial: RewardTier[] }) {
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const ladder = describeRewardLadder(saved);

  function openDrawer() {
    setDraft(saved);
    setOpen(true);
  }

  function close() {
    setDraft(saved);
    setOpen(false);
  }

  async function save() {
    const value = { tiers: sortRewardTiers(draft) };
    const problem = couponSettingsError(value);
    if (problem) {
      toast.error(problem, "Купон хадгалагдсангүй");
      return;
    }
    setBusy(true);
    try {
      if (await saveSetting("coupons", value, "Купон хадгалагдсангүй")) {
        setSaved(value.tiers);
        setDraft(value.tiers);
        setOpen(false);
        toast.success("Автомат купоны шатлал хадгалагдлаа.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium">Автомат купоны шатлал</p>
            {ladder.length === 0 ? (
              <p className="text-muted-foreground">
                Унтраалттай — одоогоор купон олгохгүй.
              </p>
            ) : (
              <p className="text-muted-foreground tabular-nums">
                {ladder.map((r, i) => (
                  <React.Fragment key={r.id}>
                    {i > 0 && " · "}
                    <span className="whitespace-nowrap">
                      {formatPrice(r.from)}+ →{" "}
                      <strong className="text-foreground">
                        {r.type === "percent"
                          ? `${r.value}%`
                          : formatPrice(r.value)}
                      </strong>
                    </span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={openDrawer}>
            <Settings2 className="size-4" />
            Шатлал тохируулах
          </Button>
        </CardContent>
      </Card>

      <FormDrawer
        open={open}
        dirty={dirty}
        onClose={close}
        title="Автомат купоны шатлал"
        description="Захиалгын дүн шатлалын доод дүнд хүрвэл худалдан авагчид купон автоматаар олгогдоно."
        discardDescription="Шатлалд хийсэн өөрчлөлт тань хадгалагдахгүй."
        footer={
          <LoadingButton loading={busy} onClick={save} disabled={!dirty}>
            {dirty ? "Хадгалах" : "Хадгалсан"}
          </LoadingButton>
        }
      >
        <div className="space-y-5">
          <RewardTierEditor tiers={draft} onChange={setDraft} />
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
            <li>
              <strong>Хэзээ:</strong> захиалгын төлбөр төлөгдмөгц купон
              хэрэглэгчийн бүртгэлд автоматаар орно.
            </li>
            <li>
              <strong>Ямар дүнгээр:</strong> худалдан авсан барааны үнээр.
              Купоноор хямдарсан бол хямдарсан үнээр нь тооцно. Хүргэлтийн
              төлбөр нэмэгдэхгүй, V point-оор төлсөн хэсэг хасагдахгүй.
            </li>
            <li>
              <strong>Хэдэн купон:</strong> нэг захиалгад нэг л купон. Хэд хэдэн
              шатлалд хүрсэн бол хамгийн өндөр шатлалынх нь олгогдоно. Жишээ нь
              100,000₮ ба 300,000₮-ийн шатлал хоёулаа асаалттай үед
              350,000₮-ийн захиалга зөвхөн 300,000₮-ийн шатлалын купоныг авна.
            </li>
            <li>
              <strong>Хэнд:</strong> зөвхөн бүртгэлтэй хэрэглэгчид. Нэвтрэлгүй
              захиалсан хүнд купон үүсэхгүй.
            </li>
          </ul>
        </div>
      </FormDrawer>
    </>
  );
}
