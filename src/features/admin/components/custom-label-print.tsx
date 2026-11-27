"use client";

import * as React from "react";
import { Download, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  perfumePageJobs,
  useLabelPrinter,
  type LabelKind,
} from "@/features/admin/hooks/use-label-printer";
import {
  binarize,
  drawAddressLabel,
  drawPerfumeLabel,
  loadLabelAssets,
  type LabelLogo,
  type PrintJob,
} from "@/features/admin/lib/niimbot-printer";
import {
  ADDRESS_COLUMNS,
  CUSTOM_LABEL_MAX,
  PERFUME_COLUMNS,
  isBlank,
  parseDelimited,
  parseMl,
  parseQty,
  tableToValues,
  type AddressKey,
  type LabelColumn,
  type LabelValues,
  type PerfumeKey,
} from "@/features/admin/lib/custom-labels";
import type { OrderLabelSource } from "@/features/admin/lib/order-label";
import {
  LABEL_KIND_ICON,
  LABEL_KIND_TEXT,
  LabelPaperNote,
  LabelPrintButton,
  PrintResumeNotice,
  PrinterConnectButton,
  PrinterUnsupported,
} from "@/features/admin/components/label-print-controls";

/** Урьдчилан харах зураг — B21/D11-ийн 203 dpi. */
const PREVIEW_DPI = 203;

type Printer = ReturnType<typeof useLabelPrinter>;

/** Ширээн дээрх мөрийн баганууд: #, талбарууд, устгах. */
const ROW_GRID: Record<LabelKind, string> = {
  address: "md:grid-cols-[1.5rem_1fr_1fr_2fr_1.5fr_4.5rem_4.5rem_2rem]",
  perfume: "md:grid-cols-[1.5rem_1fr_1.5fr_4rem_4rem_2rem]",
};

/** Утсан дээр хагас өргөнтэй (хоёр нэг мөрөнд) талбарууд. */
const HALF_WIDTH: Record<LabelKind, ReadonlySet<string>> = {
  address: new Set(["name", "phone"]),
  perfume: new Set(["ml", "qty"]),
};
const NUMERIC = new Set(["phone", "ml", "qty"]);

interface Row<K extends string> {
  id: number;
  values: LabelValues<K>;
}

let rowSeq = 0;
function blankRow<K extends string>(
  columns: readonly LabelColumn<K>[],
): Row<K> {
  return {
    id: ++rowSeq,
    values: Object.fromEntries(
      columns.map((c) => [c.key, ""]),
    ) as LabelValues<K>,
  };
}

function addressSource(v: LabelValues<AddressKey>): OrderLabelSource {
  return {
    // Гараар оруулсан шошгонд дугаар хэвлэгдэхгүй (клиент, 2026-11).
    order_no: "",
    contact_name: v.name,
    contact_phone: v.phone,
    ship_city: "",
    ship_district: null,
    ship_detail: v.address,
    ship_zone: null,
    note: v.note || null,
  };
}

const drawAddress = (
  v: LabelValues<AddressKey>,
  dpi: number,
  logo: LabelLogo | null,
) =>
  drawAddressLabel(addressSource(v), dpi, logo, {
    giftWrap: v.giftWrap === "1",
    remote: v.remote === "1",
  });

const ADDRESS_EXAMPLE: LabelValues<AddressKey> = {
  name: "Болд",
  phone: "99112233",
  address: "БЗД, 26-р хороо, 15-р байр 32 тоот",
  note: "Орой 18 цагаас хойш",
  remote: "",
  giftWrap: "1",
};

const PERFUME_EXAMPLE: LabelValues<PerfumeKey> = {
  brand: "Dior",
  name: "Sauvage Elixir",
  ml: "5",
  qty: "2",
};

const previewAddress = (v: LabelValues<AddressKey>, logo: LabelLogo | null) =>
  drawAddress(v, PREVIEW_DPI, logo);

const previewPerfume = (v: LabelValues<PerfumeKey>, logo: LabelLogo | null) =>
  drawPerfumeLabel(v.brand, v.name, PREVIEW_DPI, logo, parseMl(v.ml));

const addressJobs = (
  rows: LabelValues<AddressKey>[],
  logo: LabelLogo | null,
): PrintJob[] =>
  rows.map((v, i) => ({
    key: String(i),
    label: [v.name, v.phone].filter(Boolean).join(" "),
    draw: (dpi) => drawAddress(v, dpi, logo),
  }));

/** «Тоо» удаа давтаад хос цаасны хуудсуудад хуваана. */
const perfumeJobs = (
  rows: LabelValues<PerfumeKey>[],
  logo: LabelLogo | null,
): PrintJob[] => {
  const labels = rows.flatMap((v) =>
    Array.from({ length: parseQty(v.qty) }, () => ({
      brand: v.brand,
      name: v.name,
      ml: parseMl(v.ml),
    })),
  );
  return perfumePageJobs(labels, logo, (x) => `${x.brand} ${x.name}`).jobs;
};

const perfumeCount = (rows: LabelValues<PerfumeKey>[]) =>
  rows.reduce((s, v) => s + parseQty(v.qty), 0);

const countRows = (rows: unknown[]) => rows.length;

/**
 * Захиалгагүй шошго хэвлэх (`label_print`) — Facebook, Instagram, утсаар
 * ирсэн захиалгын хаяг, усны шошгыг гараар оруулж хэвлэнэ. Санд юу ч
 * хадгалахгүй, хуудсыг хаахад мөрүүд арилна. Олноор нь: Excel-ээс хуулж
 * хүснэгтэд буулгах эсвэл xlsx/csv файл оруулах.
 */
export function CustomLabelPrint() {
  const p = useLabelPrinter();
  const [logo, setLogo] = React.useState<LabelLogo | null | undefined>();

  React.useEffect(() => {
    let live = true;
    loadLabelAssets()
      .then((a) => live && setLogo(a.logo))
      .catch(() => live && setLogo(null));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-card space-y-2 rounded-lg p-3 text-sm">
        {p.supported ? (
          <>
            <PrinterConnectButton p={p} />
            <PrintResumeNotice p={p} />
            <LabelPaperNote />
          </>
        ) : (
          <PrinterUnsupported />
        )}
      </div>

      <LabelSheet
        kind="address"
        columns={ADDRESS_COLUMNS}
        p={p}
        logo={logo}
        example={ADDRESS_EXAMPLE}
        preview={previewAddress}
        buildJobs={addressJobs}
      />
      <LabelSheet
        kind="perfume"
        columns={PERFUME_COLUMNS}
        p={p}
        logo={logo}
        example={PERFUME_EXAMPLE}
        preview={previewPerfume}
        buildJobs={perfumeJobs}
        count={perfumeCount}
      />
    </div>
  );
}

function LabelSheet<K extends string>({
  kind,
  columns,
  p,
  logo,
  example,
  preview,
  buildJobs,
  count = countRows,
}: {
  kind: LabelKind;
  columns: readonly LabelColumn<K>[];
  p: Printer;
  /** `undefined` — фонт, лого ачаалж байна. */
  logo: LabelLogo | null | undefined;
  /** Excel загварын жишээ мөр. */
  example: LabelValues<K>;
  preview: (v: LabelValues<K>, logo: LabelLogo | null) => HTMLCanvasElement;
  buildJobs: (rows: LabelValues<K>[], logo: LabelLogo | null) => PrintJob[];
  /** Хэвлэгдэх шошгоны тоо (усанд «Тоо» баганаар). */
  count?: (rows: LabelValues<K>[]) => number;
}) {
  const [rows, setRowsRaw] = React.useState<Row<K>[]>(() => [
    blankRow(columns),
  ]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const Icon = LABEL_KIND_ICON[kind];

  // Хүснэгтийн төгсгөлд үргэлж нэг хоосон мөр — Excel шиг доош бичээд явна.
  const setRows = React.useCallback(
    (update: (prev: Row<K>[]) => Row<K>[]) =>
      setRowsRaw((prev) => {
        const next = update(prev);
        const last = next.at(-1);
        return last && isBlank(last.values, columns)
          ? next
          : [...next, blankRow(columns)];
      }),
    [columns],
  );

  const filled = rows.filter((r) => !isBlank(r.values, columns));
  const values = filled.map((r) => r.values);
  const total = count(values);
  const active =
    filled.find((r) => r.id === activeId) ?? filled.at(0) ?? undefined;

  const activeValues = active?.values;
  const previewSrc = React.useMemo(() => {
    if (!activeValues || logo === undefined) return null;
    const canvas = preview(activeValues, logo);
    binarize(canvas);
    return canvas.toDataURL();
  }, [activeValues, logo, preview]);

  const edit = (id: number, key: K, value: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r,
      ),
    );

  /** Файл/буулгасан мөрүүдийг хоосон мөрийн оронд нэмнэ. */
  const append = (incoming: LabelValues<K>[]) => {
    if (incoming.length === 0) {
      toast("Хэвлэх мөр олдсонгүй.", LABEL_KIND_TEXT[kind]);
      return;
    }
    setRows((prev) => [
      ...prev.filter((r) => !isBlank(r.values, columns)),
      ...incoming.map((values) => ({ ...blankRow(columns), values })),
    ]);
    toast.success(`${incoming.length} мөр нэмэгдлээ.`, LABEL_KIND_TEXT[kind]);
  };

  /**
   * Excel-ээс олон нүд хуулж буулгахад (tab/мөр шилжилттэй) тухайн нүднээс
   * баруун, доош нь дүүргэнэ; толгой мөртэй бол баганын нэрээр.
   */
  const onPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const pasted = tableToValues(parseDelimited(text), columns, kind, colIndex);
    setRows((prev) => {
      const next = [...prev];
      pasted.forEach((values, i) => {
        const target = next[rowIndex + i] ?? blankRow(columns);
        const set = Object.entries(values).filter(([, v]) => v !== "");
        next[rowIndex + i] = {
          ...target,
          values: { ...target.values, ...Object.fromEntries(set) },
        };
      });
      return next;
    });
  };

  const onFile = async (file: File) => {
    try {
      const table = /\.xlsx$/i.test(file.name)
        ? await readXlsx(file)
        : parseDelimited(await file.text());
      append(tableToValues(table, columns, kind));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : String(e),
        "Файл уншигдсангүй",
      );
    }
  };

  const clear = () => {
    if (
      filled.length > 1 &&
      !window.confirm(`${filled.length} мөрийг бүгдийг арилгах уу?`)
    ) {
      return;
    }
    setRowsRaw([blankRow(columns)]);
  };

  const print = () => {
    if (total > CUSTOM_LABEL_MAX) {
      toast.error(
        `Нэг удаад ${CUSTOM_LABEL_MAX} хүртэл шошго хэвлэнэ (одоо ${total}).`,
        LABEL_KIND_TEXT[kind],
      );
      return;
    }
    void p.printJobs(kind, buildJobs(values, logo ?? null));
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <Icon className="text-muted-foreground size-4" aria-hidden />
          {LABEL_KIND_TEXT[kind]}
        </h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            Excel оруулах
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onFile(file);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void downloadTemplate(kind, columns, example).catch((e) =>
                toast.error(String(e), "Загвар татагдсангүй"),
              )
            }
          >
            <Download className="size-4" aria-hidden />
            Загвар
          </Button>
          {filled.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear}>
              <X className="size-4" aria-hidden />
              Цэвэрлэх
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {/* Ширээн дээр хүснэгт шиг нэг мөр; утсан дээр мөр бүр карт —
              талбарууд доошоо, хажуу тийш гүйхгүй (клиент, 2026-11). */}
          <div
            aria-hidden
            className={cn(
              "text-muted-foreground hidden gap-2 px-1 pb-1 text-xs md:grid",
              ROW_GRID[kind],
            )}
          >
            <span>#</span>
            {columns.map((c) => (
              <span key={c.key} className={cn(c.bool && "text-center")}>
                {c.label}
              </span>
            ))}
            <span />
          </div>
          <ul className="space-y-2 md:space-y-0">
            {rows.map((row, ri) => {
              const blank = isBlank(row.values, columns);
              return (
                <li
                  key={row.id}
                  onFocus={() => setActiveId(row.id)}
                  className={cn(
                    "grid grid-cols-2 items-center gap-2 rounded-lg p-3 md:rounded-md md:p-1",
                    ROW_GRID[kind],
                    active?.id === row.id
                      ? "bg-secondary/60"
                      : "max-md:bg-secondary/30",
                  )}
                >
                  <span className="text-muted-foreground text-xs tabular-nums max-md:order-first">
                    {blank ? (
                      <span className="md:hidden">Шинэ мөр</span>
                    ) : (
                      <>
                        <span className="md:hidden">Мөр </span>
                        {ri + 1}
                      </>
                    )}
                  </span>
                  {columns.map((c, ci) =>
                    c.bool ? (
                      <label
                        key={c.key}
                        className="flex items-center gap-2 text-sm md:justify-center"
                      >
                        <Checkbox
                          aria-label={`${ri + 1}-р мөр: ${c.label}`}
                          checked={row.values[c.key] === "1"}
                          onCheckedChange={(v) =>
                            edit(row.id, c.key, v === true ? "1" : "")
                          }
                        />
                        <span className="md:sr-only">{c.label}</span>
                      </label>
                    ) : (
                      <label
                        key={c.key}
                        className={cn(
                          "min-w-0 space-y-1",
                          !HALF_WIDTH[kind].has(c.key) && "max-md:col-span-2",
                        )}
                      >
                        <span className="text-muted-foreground text-xs md:sr-only">
                          {c.label}
                        </span>
                        <Input
                          aria-label={`${ri + 1}-р мөр: ${c.label}`}
                          value={row.values[c.key]}
                          placeholder={ri === 0 ? example[c.key] : ""}
                          inputMode={NUMERIC.has(c.key) ? "numeric" : undefined}
                          className="md:h-8 md:px-2"
                          onChange={(e) => edit(row.id, c.key, e.target.value)}
                          onPaste={(e) => onPaste(e, ri, ci)}
                        />
                      </label>
                    ),
                  )}
                  <span className="justify-self-end max-md:order-first">
                    {!blank && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`${ri + 1}-р мөр устгах`}
                        onClick={() =>
                          setRows((prev) => prev.filter((r) => r.id !== row.id))
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Excel-ээс олон мөр хуулаад хүснэгтийн нүдэнд буулгаж (Ctrl+V) болно
            — толгой мөртэй бол баганын нэрээр, үгүй бол тухайн нүднээс эхлэн
            дүүргэнэ.
            {kind === "perfume" &&
              " «Тоо» — нэг уснаас хэдэн шошго; хос цаасанд хоёр хоёроор гарна."}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => setRowsRaw((prev) => [...prev, blankRow(columns)])}
          >
            <Plus className="size-4" aria-hidden />
            Мөр нэмэх
          </Button>
        </div>

        <LabelPreview kind={kind} src={previewSrc} />
      </div>

      {p.supported && (
        <div className="flex justify-end">
          <LabelPrintButton
            p={p}
            kind={kind}
            count={total}
            disabled={total === 0 || logo === undefined}
            onPrint={print}
          />
        </div>
      )}
    </Card>
  );
}

/** Сонгосон мөрийн шошго — хэвлэгчид очих хар/цагаан зургаар (`binarize`). */
function LabelPreview({ kind, src }: { kind: LabelKind; src: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1 lg:w-48">
      <span className="text-muted-foreground self-start text-xs">
        Урьдчилан харах
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- canvas-аас үүссэн data URL
        <img
          src={src}
          alt={`${LABEL_KIND_TEXT[kind]}ийн загвар`}
          className={cn(
            "rounded-sm bg-white shadow-sm",
            kind === "address" ? "w-44" : "w-48",
          )}
        />
      ) : (
        <div
          className={cn(
            "bg-secondary text-muted-foreground flex items-center justify-center rounded-sm text-xs",
            kind === "address" ? "aspect-45/60 w-44" : "aspect-40/15 w-48",
          )}
        >
          Мөр бөглөөрэй
        </div>
      )}
    </div>
  );
}

/** xlsx-ийн эхний хуудсыг текст хүснэгт болгоно (exceljs — зөвхөн энд ачаална). */
async function readXlsx(file: File): Promise<string[][]> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const table: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      cells.push(row.getCell(c).text?.trim() ?? "");
    }
    if (cells.some(Boolean)) table.push(cells);
  }
  return table;
}

async function downloadTemplate<K extends string>(
  kind: LabelKind,
  columns: readonly LabelColumn<K>[],
  example: LabelValues<K>,
) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(LABEL_KIND_TEXT[kind]);
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.bool || c.key === "ml" || c.key === "qty" ? 12 : 24,
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(example);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kind === "address" ? "hayag" : "us"}-shoshgo.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
