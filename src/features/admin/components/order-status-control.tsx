"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderStatus,
} from "@/lib/constants";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { mutateJson } from "@/features/admin/lib/mutate";

type Tone = "default" | "secondary" | "destructive";

type Transition = {
  to: OrderStatus;
  /** Verb, not a state name: the button says what pressing it does. */
  label: string;
  hint?: string;
  tone: Tone;
  confirm?: { title: string; description: string; label: string };
};

const CANCEL: Transition = {
  to: "cancelled",
  label: "Захиалга цуцлах",
  hint: "Захиалагдсан мл үлдэгдэл рүү нээгдэж, худалдан авагчид цуцлагдсан гэж харагдана.",
  tone: "destructive",
  confirm: {
    title: "Захиалгыг цуцлах уу?",
    description:
      "Захиалагдсан мл нь үлдэгдэл рүү буцаж нээгдэнэ. Худалдан авагчид цуцлагдсан гэж харагдана.",
    label: "Цуцлах",
  },
};

/**
 * Which statuses may follow the current one. Without this every status was
 * reachable from every other, so «Хүргэгдсэн → Хүлээгдэж буй» and an
 * irreversible cancellation sat one click apart in the same Select. Each edge
 * also carries the verb for the submit button, so the operator reads what the
 * click does rather than inferring it from a state name.
 */
const TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
  pending: [
    {
      to: "confirmed",
      label: "Баталгаажуулах",
      hint: "Захиалгыг хүлээн авч, бэлтгэлд оруулна.",
      tone: "default",
    },
    CANCEL,
  ],
  confirmed: [
    {
      to: "shipping",
      label: "Хүргэлтэд гаргах",
      hint: "Түгээгчид шилжүүлж, хүргэлт эхэлснийг бүртгэнэ.",
      tone: "default",
    },
    CANCEL,
  ],
  shipping: [
    {
      to: "delivered",
      label: "Хүргэгдсэн гэж бүртгэх",
      hint: "Худалдан авагч хүлээж авсан. Үүний дараа төлөв хаагдана.",
      tone: "default",
    },
    {
      // A courier who cannot deliver brings the parcel back — an ordinary day
      // in Ulaanbaatar, not an exception.
      to: "confirmed",
      label: "Хүргэлтээс буцаасан",
      hint: "Хүргэж чадаагүй бараа буцаж ирсэн. Дахин хүргэлтэд гаргах боломжтой болно.",
      tone: "secondary",
      confirm: {
        title: "Хүргэлтээс буцаах уу?",
        description:
          "Захиалга «Баталгаажсан» төлөвт эргэн орж, дахин хүргэлтэд гаргах боломжтой болно.",
        label: "Буцаах",
      },
    },
    CANCEL,
  ],
  delivered: [],
  cancelled: [],
};

/**
 * Recovery edges, super_admin only. Making `delivered`/`cancelled` absolutely
 * terminal did not remove the cost of a mis-tap — it moved that cost to the
 * Supabase console, off the audit trail. These put it back in the UI, where
 * `order_status_history` records who did it and why.
 */
const RECOVERY: Record<OrderStatus, readonly Transition[]> = {
  pending: [],
  confirmed: [],
  shipping: [],
  delivered: [
    {
      to: "shipping",
      label: "Хүргэлт рүү буцаах",
      hint: "Андуурч хаасан захиалгыг дахин хүргэлтэд оруулна.",
      tone: "secondary",
      confirm: {
        title: "«Хүргэгдсэн» тэмдэглэгээг буцаах уу?",
        description:
          "Захиалга дахин хүргэлтэд орно. Андуурч хаасан тохиолдолд л хэрэглэнэ.",
        label: "Буцаах",
      },
    },
  ],
  cancelled: [
    {
      to: "pending",
      label: "Захиалгыг сэргээх",
      // Honest about its limits: the cancel unwind is not replayed backwards,
      // so the ml has to be re-checked by hand before promising it.
      hint: "Зөвхөн төлвийг сэргээнэ. Мл, оноо, купон автоматаар эргэж захиалагдахгүй тул үлдэгдлээ шалгана уу.",
      tone: "secondary",
      confirm: {
        title: "Цуцалсан захиалгыг сэргээх үү?",
        description:
          "Захиалга «Хүлээгдэж буй» болж, мл дахин захиалагдана. Үлдэгдэл хүрэлцэхгүй бол сэргээхгүй.",
        label: "Сэргээх",
      },
    },
  ],
};

const TERMINAL_TEXT: Partial<Record<OrderStatus, string>> = {
  delivered: "Захиалга хүргэгдэж дууссан тул цаашид төлөв өөрчлөгдөхгүй.",
  cancelled: "Захиалга цуцлагдсан тул цаашид төлөв өөрчлөгдөхгүй.",
};

export function OrderStatusControl({
  orderId,
  current,
  paymentStatus,
  hasQpayInvoice = false,
  canRecover = false,
}: {
  orderId: string;
  current: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  /**
   * Захиалгад QPay invoice байгаа эсэх. Байвал оператор итгэл дээр
   * тэмдэглэхийн оронд QPay-ээс ШАЛГУУЛЖ болно.
   */
  hasQpayInvoice?: boolean;
  /** super_admin only — unlocks the recovery edges out of a terminal status. */
  canRecover?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  /** Empty until the operator picks a destination — never the current status. */
  const [target, setTarget] = React.useState<OrderStatus | "">("");
  const [confirm, confirmDialog] = useConfirm();

  const steps = TRANSITIONS[current];
  // Money already went back: the order is closed for good, not a draft to
  // reopen. Restoring it would leave a live order nobody has paid for.
  const recovery =
    canRecover && paymentStatus !== "refunded" ? RECOVERY[current] : [];

  /**
   * A failed status change used to produce nothing at all — no refresh, no
   * message, the button simply un-busied. Every outcome now speaks.
   */
  async function post(
    payload: Record<string, unknown>,
    successText: string,
    errorTitle: string,
  ) {
    setBusy(true);
    try {
      const ok = await mutateJson(
        `/api/admin/orders/${orderId}/status`,
        "POST",
        payload,
        errorTitle,
      );
      if (!ok) return;
      toast.success(successText);
      setNote("");
      setTarget("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function run(t: Transition) {
    if (t.confirm) {
      const ok = await confirm({
        title: t.confirm.title,
        description:
          t.to === "cancelled" && paymentStatus === "paid"
            ? `${t.confirm.description} Мөнгийг нь гараар шилжүүлсний дараа энэ хуудаснаас «Буцаалт хийх» гэж тэмдэглэнэ.`
            : t.confirm.description,
        confirmLabel: t.confirm.label,
        destructive: t.tone === "destructive",
      });
      if (!ok) return;
    }
    await post(
      { status: t.to, note },
      `Төлөв «${ORDER_STATUS_LABEL[t.to]}» боллоо.`,
      "Төлөв солигдсонгүй",
    );
  }

  async function refund() {
    const ok = await confirm({
      title: "Мөнгийг нь буцаасан уу?",
      description:
        "Сайт мөнгө шилжүүлэхгүй — та өөрөө буцаасан бол энд баримт болгон тэмдэглэнэ. Энэ тэмдэглэгээг сайтаас арилгах боломжгүй.",
      confirmLabel: "Буцаалт хийх",
      destructive: true,
    });
    if (!ok) return;
    await post(
      { refund: true },
      "Буцаалт бүртгэгдлээ.",
      "Буцаалт бүртгэгдсэнгүй",
    );
  }

  /**
   * Хүргэгдсэний дараах буцаалт (docs/analysis/order_status_ux_proposal.md
   * §3.5). Захиалга биетээр хүргэгдсэн, хэрэглэгч хэрэглэсэн байж болзошгүй
   * тул цуцлалтын механизмыг (ml/оноо/купон авто буцаалт) ДАХИН АШИГЛАХГүй
   * — зөвхөн `payment_status`-ыг л шууд `refunded` болгоно, `order_status`
   * хэвээрээ `delivered` үлдэнэ. Зөвхөн super_admin-д харагдана (доор).
   */
  async function refundDelivered() {
    const ok = await confirm({
      title: "Барааг биетээр хүлээж авсан уу?",
      description:
        "Барааг биетээр хүлээж авсны дараа л дарна уу. Захиалга «Хүргэгдсэн» хэвээр үлдэнэ, зөвхөн төлбөрийг «Буцаагдсан» гэж тэмдэглэнэ. Мл үлдэгдэлд автоматаар буцахгүй — шинэ, нээгдээгүй бол Үлдэгдэл хуудаснаас өөрөө гараар нэмнэ.",
      confirmLabel: "Тийм, буцаалт хийх",
      destructive: true,
    });
    if (!ok) return;
    await post(
      { refund: true },
      "Буцаалт бүртгэгдлээ.",
      "Буцаалт бүртгэгдсэнгүй",
    );
  }

  const all = [...steps, ...recovery];
  const selected = all.find((t) => t.to === target) ?? null;

  return (
    <div className="space-y-5">
      {confirmDialog}

      <section className="space-y-2">
        {/* No «одоогийн төлөв» line here — the page header chip carries it. */}
        <h3 className="text-sm font-medium">Төлөв</h3>

        {all.length === 0 ? (
          <p className="bg-secondary text-muted-foreground rounded-md px-3 py-2 text-sm">
            {TERMINAL_TEXT[current]}{" "}
            {paymentStatus === "refunded"
              ? "Мөнгийг буцаасан тул төлвийг цаашид сэргээх боломжгүй."
              : "Андуурсан бол супер админаар сэргээлгэнэ үү."}
          </p>
        ) : (
          <>
            {/* The current status is NOT an option: the Select answers «хаашаа
                шилжих вэ», so a no-op choice would only be a dead end. */}
            <Select
              value={target || undefined}
              onValueChange={(v) => setTarget(v as OrderStatus)}
            >
              <SelectTrigger aria-label="Шилжих төлөв">
                <SelectValue placeholder="Шилжих төлөвөө сонгоно уу" />
              </SelectTrigger>
              <SelectContent>
                {all.map((t) => (
                  <SelectItem key={t.to} value={t.to}>
                    {ORDER_STATUS_LABEL[t.to]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Төлөв солих тэмдэглэл"
              placeholder="Тэмдэглэл (заавал биш)"
            />

            <Button
              variant={selected?.tone ?? "default"}
              className="h-11 w-full md:h-10"
              disabled={busy || !selected}
              onClick={() => selected && run(selected)}
            >
              {busy
                ? "Шинэчилж байна…"
                : (selected?.label ?? "Төлөв сонгоно уу")}
            </Button>
          </>
        )}
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Төлбөр</h3>
          <span className="text-muted-foreground text-xs">
            {PAYMENT_STATUS_LABEL[paymentStatus]}
          </span>
        </div>

        {/* Refund follows cancellation, never replaces it: cancelling is what
            returns the ml, the V points and the coupon (0019/0040), and the
            money itself is moved by hand. So the button only exists on a
            cancelled order — and there it is the outstanding task. */}
        {paymentStatus === "refunded" ? (
          <p className="text-muted-foreground text-xs">
            Төлбөр буцаагдсан. Нэмэлт үйлдэл шаардлагагүй.
          </p>
        ) : paymentStatus === "paid" ? (
          current === "cancelled" ? (
            <>
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                Захиалга цуцлагдсан ч төлбөр буцаагдаагүй байна. Мөнгийг
                хэрэглэгчид шилжүүлээд доорх товчоор баталгаажуулна уу.
              </p>
              <Button
                variant="destructive"
                className="h-11 w-full md:h-10"
                disabled={busy}
                onClick={refund}
              >
                Буцаалт хийх
              </Button>
            </>
          ) : current === "delivered" && canRecover ? (
            <>
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                Захиалга хүргэгдсэн. Барааг биетээр буцааж хүлээж авсны
                дараа доорх товчоор мөнгийг буцаасан гэж тэмдэглэнэ үү.
                Захиалгын төлөв «Хүргэгдсэн» хэвээр үлдэнэ.
              </p>
              <Button
                variant="destructive"
                className="h-11 w-full md:h-10"
                disabled={busy}
                onClick={refundDelivered}
              >
                Хүргэгдсэний дараах буцаалт
              </Button>
            </>
          ) : current === "delivered" ? (
            <p className="text-muted-foreground text-xs">
              Захиалга хүргэгдсэн. Хүргэгдсэний дараах буцаалтыг зөвхөн
              super_admin хийж чадна.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Төлбөр буцаахын өмнө захиалгыг цуцлах ёстой — цуцлахад мл, V
              point, купон нь автоматаар буцаж, дараа нь буцаалт бүртгэнэ.
            </p>
          )
        ) : current === "cancelled" ? (
          <p className="text-muted-foreground text-xs">
            Захиалга төлөгдөөгүй цуцлагдсан тул төлбөрийн үйлдэл байхгүй.
          </p>
        ) : (
          <div className="space-y-2">
            {/* QPay invoice байгаа бол ЭНЭ нь зөв эхний алхам: гараар
                тэмдэглэх нь QPay-ээс юу ч асуудаггүй, ажилтны итгэл дээр
                бичдэг. Тиймээс энэ нь үндсэн үйлдэл, гараар нь хоёрдогч. */}
            {hasQpayInvoice && (
              <>
                <Button
                  className="h-11 w-full md:h-9"
                  disabled={busy}
                  onClick={() =>
                    post(
                      { recheck: true },
                      "QPay төлбөрийг баталлаа.",
                      "Төлбөр олдсонгүй",
                    )
                  }
                >
                  QPay-ээс дахин шалгах
                </Button>
                <p className="text-muted-foreground text-xs">
                  QPay-ээс шууд асууна. Хэрэглэгч «төлсөн» гэж хэлсэн үед эхлээд
                  үүнийг ашиглаарай — доорх товч нь QPay-ээс юу ч асуудаггүй,
                  зөвхөн таны үгээр бүртгэнэ.
                </p>
              </>
            )}
            <Button
              variant="secondary"
              className="h-11 w-full md:h-9"
              disabled={busy}
              onClick={() =>
                post(
                  { paid: true },
                  "Төлсөн гэж тэмдэглэгдлээ.",
                  "Тэмдэглэгдсэнгүй",
                )
              }
            >
              Төлсөн гэж тэмдэглэх
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
