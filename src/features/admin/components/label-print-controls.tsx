"use client";

import {
  AlertTriangle,
  Bluetooth,
  BluetoothOff,
  Droplet,
  Play,
  Printer,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LABEL_PAPERS,
  disconnectPrinter,
} from "@/features/admin/lib/niimbot-printer";
import type {
  LabelKind,
  useLabelPrinter,
} from "@/features/admin/hooks/use-label-printer";

/**
 * Шошго хэвлэх UI-ийн жижиг хэсгүүд (`label_print`) — захиалгын жагсаалт ба
 * дэлгэрэнгүй хуудас хоёулаа ашиглана. Дүрс: хаяг = `Printer`, ус = `Droplet`
 * — «Шошго» баганад бичиггүй, зөвхөн дүрс (клиент, 2026-11).
 */
export const LABEL_KIND_ICON = { address: Printer, perfume: Droplet } as const;
export const LABEL_KIND_TEXT: Record<LabelKind, string> = {
  address: "Хаягийн шошго",
  perfume: "Усны шошго",
};

/** Хэвлэгдсэн шошгоны дүрсүүд; аль нь ч хэвлэгдээгүй бол «—». */
export function LabelPrintedIcons({
  addressAt,
  perfumeAt,
}: {
  addressAt?: string | null;
  perfumeAt?: string | null;
}) {
  const marks = (
    [
      ["address", addressAt],
      ["perfume", perfumeAt],
    ] as const
  ).filter(([, at]) => at);
  if (marks.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="text-success inline-flex items-center gap-1.5">
      {marks.map(([kind, at]) => {
        const Icon = LABEL_KIND_ICON[kind];
        const text = `${LABEL_KIND_TEXT[kind]} хэвлэсэн: ${formatDateTime(at!)}`;
        return (
          <Icon key={kind} className="size-4" aria-label={text}>
            <title>{text}</title>
          </Icon>
        );
      })}
    </span>
  );
}

type Printer = ReturnType<typeof useLabelPrinter>;

export function PrinterUnsupported() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <BluetoothOff className="size-4 shrink-0" aria-hidden />
      Шошго хэвлэхэд компьютер эсвэл Android дээрх Chrome / Edge хэрэгтэй
      (iPhone, Safari Bluetooth дэмждэггүй).
    </div>
  );
}

export function PrinterConnectButton({ p }: { p: Printer }) {
  if (p.printer) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void disconnectPrinter()}
        disabled={p.busy !== null}
        title="Салгах"
      >
        <Bluetooth className="text-success size-4" aria-hidden />
        {p.printer}
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => void p.connect()}
      disabled={p.busy !== null}
    >
      <Bluetooth className="size-4" aria-hidden />
      {p.busy === "connect" ? "Холбогдож байна…" : "Хэвлэгч холбох"}
    </Button>
  );
}

/** Хаяг/усны хэвлэх товч; хэвлэж байх үед явц + «Зогсоох». */
export function LabelPrintButton({
  p,
  kind,
  onPrint,
  disabled,
  count,
  className,
}: {
  p: Printer;
  kind: LabelKind;
  onPrint: () => void;
  disabled?: boolean;
  /** Товчны шошгонд «(N)» — жагсаалтаас олныг сонгоход. */
  count?: number;
  className?: string;
}) {
  const Icon = LABEL_KIND_ICON[kind];
  const paper = LABEL_PAPERS[kind];
  if (p.busy === kind) {
    return (
      <Button
        size="sm"
        variant="destructive"
        onClick={p.stop}
        disabled={p.stopping}
        className={className}
        title="Одоо хэвлэгдэж буй шошгыг дуусгаад зогсоно"
      >
        <Square className="size-3.5 fill-current" aria-hidden />
        {p.stopping
          ? `Зогсож байна… ${p.progress ?? ""}`
          : `Зогсоох ${p.progress ?? ""}`}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant={kind === "address" ? "default" : "secondary"}
      onClick={onPrint}
      disabled={disabled || p.busy !== null}
      className={cn(className)}
      title={`${paper.widthMm}×${paper.heightMm} мм цаас`}
    >
      <Icon className="size-4" aria-hidden />
      {kind === "address" ? "Хаяг хэвлэх" : "Усны шошго"}
      {count !== undefined && ` (${count})`}
    </Button>
  );
}

/**
 * Тасарсан хэвлэлт (цаас/цэнэг дууссан, холболт тасарсан, «Зогсоох»):
 * хэдэн нь хэвлэгдсэн, юунаас болсон, «Үргэлжлүүлэх» — алдаа гарсан шошгоос
 * нь дахин эхэлнэ.
 */
export function PrintResumeNotice({ p }: { p: Printer }) {
  const run = p.paused;
  if (!run || p.busy === run.kind) return null;
  const unit = run.kind === "perfume" ? "хуудас" : "шошго";
  const left = run.jobs.length - run.next;
  return (
    <div className="bg-secondary space-y-2 rounded-md p-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle
          className="text-warning mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <span>
          {LABEL_KIND_TEXT[run.kind]}: {run.next}/{run.jobs.length} {unit}{" "}
          хэвлэгдээд {run.error ? "тасарсан" : "зогссон"}.
          {run.error && (
            <span className="text-muted-foreground block text-xs">
              {run.error}. Цаас, цэнэгээ шалгаад үргэлжлүүлнэ үү.
            </span>
          )}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void p.resume()}
          disabled={p.busy !== null}
        >
          <Play className="size-3.5 fill-current" aria-hidden />
          Үргэлжлүүлэх ({left} {unit} үлдсэн)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={p.discard}
          disabled={p.busy !== null}
        >
          Болих
        </Button>
      </div>
    </div>
  );
}

/** HarmonyOS Sans-ийн лицензийн шаардлага: ашигласнаа заана. */
export function LabelPaperNote() {
  const { address, perfume } = LABEL_PAPERS;
  return (
    <p className="text-muted-foreground text-xs">
      Хаяг {address.widthMm}×{address.heightMm} мм, ус {perfume.widthMm}×
      {perfume.heightMm} мм цаас · Фонт: HarmonyOS Sans
    </p>
  );
}
