"use client";

import type {
  NiimbotBluetoothClient,
  PrintDirection,
} from "@mmote/niimbluelib";
import {
  orderLabelLines,
  perfumeLabelLayout,
  wrapSegments,
  type OrderLabelSource,
} from "./order-label";

/**
 * Niimbot хэвлэгч (0202, `label_print`) — Web Bluetooth, @mmote/niimbluelib.
 *
 * Хэвлэлт бүхэлдээ админы браузерт явагдана; сервер оролцохгүй. Холболт
 * модулийн түвшинд нэг л байна — admin доторх client навигацид тасрахгүй,
 * хуудас refresh хийхэд л дахин сонгоно (Web Bluetooth-ийн аюулгүй байдлын
 * шаардлага: анхны холболт заавал хэрэглэгчийн товшилтоор).
 *
 * Сан нь зөвхөн энэ хуудсанд хэрэгтэй тул динамикаар ачаална.
 */

/** Шошгоны цаас — өргөн × өндөр (мм), текст уншигдах чиглэлээр. */
export interface LabelPaper {
  widthMm: number;
  heightMm: number;
}

/**
 * Клиентийн цааснууд (niimbot.xlsx, 2026-11): гадна хаяг 45×60, усны хаяг
 * 40×15. Фонт нь пунктээр (Niimbot апп-ын «хэмжээ»), багтахгүй бол жижгэрнэ.
 */
export const LABEL_PAPERS = {
  address: { widthMm: 45, heightMm: 60, fontPt: 13 },
  /**
   * Хос цаас: 40×15 шошго хоёр хоёроороо наалдсан, хос бүрийн дараа зай —
   * хэвлэгч зайг хуудасны төгсгөл гэж мэддэг тул нэг хуудас = 2 шошго
   * (дээд, доод). Ганц шошгоор хуудас илгээвэл доод нь хоосон үлддэг байв.
   */
  perfume: { widthMm: 40, heightMm: 15, fontPt: 12.5, perPage: 2 },
} as const;

/**
 * HarmonyOS Sans Regular/Bold (public/fonts/harmonyos-sans, Huawei-ийн
 * лиценз — өөрчлөхгүйгээр хамт түгээж болно, ашигласнаа заах ёстой).
 * Клиентийн усны хаягийн «HEALTHY» фонт олдоогүй тул түр энэ фонтоор.
 */
export const LABEL_FONT_FAMILY = "VS Label HarmonyOS Sans";
const LABEL_FONT_FILES = [
  { weight: "400", url: "/fonts/harmonyos-sans/HarmonyOS_Sans_Regular.ttf" },
  { weight: "700", url: "/fonts/harmonyos-sans/HarmonyOS_Sans_Bold.ttf" },
];
const FONT_STACK = `"${LABEL_FONT_FAMILY}", Arial, Helvetica, sans-serif`;
/**
 * VON/SCENT лого — сайтын `von-mark.png`-ийг вектор болгосон SVG (клиент,
 * 2026-11). Шошгон дээр тухайн хэмжээгээр нь шууд зурагдах тул ирмэг нь
 * хурц; хар/цагааныг зурах үед нь будна (`drawLogo`).
 */
const LOGO_URL = "/brand/von-mark.svg";

export interface LabelLogo {
  image: HTMLImageElement;
  /** өргөн / өндөр */
  aspect: number;
}

/**
 * Логог тухайн хэмжээгээр нь (вектороор) зураад `color`-оор будна —
 * цагаан цаасан дээр хар, хар дэвсгэр дээр цагаан.
 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: LabelLogo,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(w));
  tmp.height = Math.max(1, Math.round(h));
  const t = tmp.getContext("2d");
  if (!t) return;
  t.drawImage(logo.image, 0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = "source-in";
  t.fillStyle = color;
  t.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, Math.round(x), Math.round(y));
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

type Listener = () => void;

let client: NiimbotBluetoothClient | null = null;
let deviceName: string | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export function subscribePrinter(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function printerName(): string | null {
  return client?.isConnected() ? (deviceName ?? "Niimbot") : null;
}

/** Хэвлэгч сонгох цонх нээж холбогдоно. Товшилтын handler дотроос л дууд. */
export async function connectPrinter(): Promise<string> {
  const lib = await import("@mmote/niimbluelib");
  if (client?.isConnected()) await client.disconnect();
  const next = new lib.NiimbotBluetoothClient();
  next.on("disconnect", () => {
    if (client === next) {
      client = null;
      deviceName = null;
      notify();
    }
  });
  const info = await next.connect();
  client = next;
  deviceName = info.deviceName ?? "Niimbot";
  notify();
  return deviceName;
}

export async function disconnectPrinter(): Promise<void> {
  const c = client;
  client = null;
  deviceName = null;
  notify();
  await c?.disconnect();
}

let assets: Promise<{ logo: LabelLogo | null }> | null = null;

/** Фонт ба логог нэг удаа ачаална. Унавал Arial / логогүй. */
export function loadLabelAssets(): Promise<{ logo: LabelLogo | null }> {
  assets ??= (async () => {
    await Promise.all(
      LABEL_FONT_FILES.map(async ({ weight, url }) => {
        try {
          const face = new FontFace(LABEL_FONT_FAMILY, `url(${url})`, {
            weight,
          });
          document.fonts.add(await face.load());
        } catch {
          // Фонт ачаалагдахгүй бол Arial-аар — хэвлэлт зогсохгүй.
        }
      }),
    );
    let logo: LabelLogo | null = null;
    try {
      const image = new Image();
      image.src = LOGO_URL;
      await image.decode();
      logo = { image, aspect: image.naturalWidth / image.naturalHeight };
    } catch {
      logo = null;
    }
    return { logo };
  })();
  return assets;
}

const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
const ptToPx = (pt: number, dpi: number) => (pt / 72) * dpi;
const font = (px: number, bold = true) =>
  `${bold ? 700 : 400} ${Math.round(px)}px ${FONT_STACK}`;
const LINE_GAP = 1.18;

function newCanvas(paper: LabelPaper, dpi: number) {
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(paper.widthMm, dpi);
  canvas.height = mmToPx(paper.heightMm, dpi);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas дэмжигдэхгүй байна");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

/**
 * Lucide `gift` дүрс (24×24 viewBox) — өнгөт emoji хар/цагаанд хэвлэхэд
 * толбо болдог тул шугаман дүрсээр.
 */
const GIFT_ICON_PATHS = [
  "M3 9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
  "M12 8v13",
  "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7",
  "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
];

function drawGiftIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of GIFT_ICON_PATHS) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/**
 * Гадна хаяг (45×60): дугаар (бэлгийн боолттой бол баруун захад 🎁), «Нэр:», «Утас:», «Хаяг:»,
 * «Тэмдэглэл:» мөрүүд; доор нь голлуулсан VON/SCENT лого. Текст багтахгүй
 * бол фонт жижгэрнэ, хамгийн жижигт ч багтахгүй бол сүүлийн мөрийг «…»-ээр
 * таслана.
 */
export function drawAddressLabel(
  order: OrderLabelSource,
  dpi: number,
  logo: LabelLogo | null,
  opts: { giftWrap?: boolean; remote?: boolean } = {},
): HTMLCanvasElement {
  const paper = LABEL_PAPERS.address;
  const { canvas, ctx } = newCanvas(paper, dpi);
  const w = canvas.width;
  const h = canvas.height;
  const pad = mmToPx(2, dpi);
  const maxW = w - pad * 2;

  // Лого: шошгоны өндрийн ~22%, доод талд голлуулна.
  let textBottom = h - pad;
  if (logo) {
    const lh = Math.round(h * 0.22);
    const lw = Math.round(logo.aspect * lh);
    const ly = h - pad - lh;
    drawLogo(ctx, logo, (w - lw) / 2, ly, lw, lh, "#000");
    textBottom = ly - mmToPx(2, dpi);
  }

  const paragraphs = orderLabelLines(order, opts);
  const blockGap = mmToPx(1, dpi);
  const iconGap = (px: number) => px * 0.35;
  const layout = (px: number) => {
    const measure = (s: string, bold: boolean) => {
      ctx.font = font(px, bold);
      return ctx.measureText(s).width;
    };
    return paragraphs.map((p) =>
      wrapSegments(p.segments, maxW, measure, p.icon ? px + iconGap(px) : 0),
    );
  };
  const heightOf = (blocks: unknown[][], px: number) =>
    blocks.reduce((s, b) => s + b.length * px * LINE_GAP, 0) +
    blockGap * (blocks.length - 1);

  const avail = textBottom - pad;
  let px = ptToPx(paper.fontPt, dpi);
  const minPx = px * 0.6;
  let blocks = layout(px);
  while (heightOf(blocks, px) > avail && px > minPx) {
    px *= 0.95;
    blocks = layout(px);
  }

  const rows = blocks.flatMap((b, bi) =>
    b.map((segments, li) => ({
      segments,
      icon: li === 0 ? paragraphs[bi].icon : undefined,
      gapAfter: li === b.length - 1 && bi < blocks.length - 1,
    })),
  );
  let y = pad;
  for (const [i, row] of rows.entries()) {
    const nextY = y + px * LINE_GAP + (row.gapAfter ? blockGap : 0);
    // Дараагийн мөр багтахгүй бол энэ нь сүүлчийнх — «…»-ээр таслана.
    const last = i < rows.length - 1 && nextY + px > textBottom;
    let x = pad;
    if (row.icon === "gift") {
      drawGiftIcon(ctx, pad + maxW - px, y - px * 0.05, px);
    }
    for (const [si, seg] of row.segments.entries()) {
      ctx.font = font(px, seg.bold);
      const text =
        last && si === row.segments.length - 1
          ? ellipsize(seg.text, pad + maxW - x, (s) => ctx.measureText(s).width)
          : seg.text;
      ctx.fillText(text, x, y);
      x += ctx.measureText(`${text} `).width;
    }
    if (last) break;
    y = nextY;
  }
  return canvas;
}

/** Брэндийн том үсгийн зай (фонтын хэмжээний хувиар). */
const BRAND_TRACKING = 0.18;

/**
 * Усны хаяг (40×15), клиентийн сонгосон «D2» загвар (2026-11): хар
 * дэвсгэр, давхар цагаан хүрээ, зүүн талд цагаан VON лого; баруун талд
 * БРЭНД (том үсэг, зайтай, нэрээс жижиг), `──◆──` зураас, усны нэр (тод,
 * ≤2 мөр). Брэнд заавал нэг мөрөнд, нийт гурваас илүүгүй мөр — багтахгүй бол
 * фонт жижгэрнэ (niimbot.xlsx-ийн memo). Дэвсгэр шошгоны ирмэгээс бага
 * зэрэг дотогшоо — термал хэвлэгч ирмэг хүртэл яг тааруулж чаддаггүй.
 */
export function drawPerfumeLabel(
  brand: string,
  name: string,
  dpi: number,
  logo: LabelLogo | null,
  /** Савны хэмжээ — зүүн доод буланд жижиг тоогоор («2», «5»). */
  ml?: number | null,
): HTMLCanvasElement {
  const paper = LABEL_PAPERS.perfume;
  const { canvas, ctx } = newCanvas(paper, dpi);
  const w = canvas.width;
  const h = canvas.height;

  const inset = mmToPx(0.6, dpi);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, mmToPx(1.5, dpi));
  ctx.fill();

  const frame = mmToPx(1.2, dpi);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, mmToPx(0.25, dpi));
  ctx.beginPath();
  ctx.roundRect(frame, frame, w - frame * 2, h - frame * 2, mmToPx(1, dpi));
  ctx.stroke();

  // Лого: зүүн талд, 8.2 мм өргөнд багтана.
  let textLeft = mmToPx(2.2, dpi);
  if (logo) {
    let lh = h - mmToPx(3.8, dpi);
    let lw = logo.aspect * lh;
    const maxLw = mmToPx(8.2, dpi);
    if (lw > maxLw) {
      lh *= maxLw / lw;
      lw = maxLw;
    }
    // Мл-ийн тоонд зай гаргаж бага зэрэг дээш (клиент, 2026-11).
    const lift = ml ? mmToPx(0.9, dpi) : 0;
    drawLogo(
      ctx,
      logo,
      mmToPx(6.5, dpi) - lw / 2,
      (h - lh) / 2 - lift,
      lw,
      lh,
      "#fff",
    );
    textLeft = mmToPx(11.6, dpi);
  }

  // Мл: зүүн доод буланд, хүрээний дотор жижиг тоо.
  if (ml) {
    const px = mmToPx(1.9, dpi);
    ctx.fillStyle = "#fff";
    ctx.font = font(px, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(ml), mmToPx(2.4, dpi), h - mmToPx(2.3, dpi));
    ctx.textBaseline = "top";
  }
  const textRight = w - mmToPx(2.2, dpi);
  const padY = mmToPx(1.8, dpi);
  const cx = (textLeft + textRight) / 2;
  const maxW = textRight - textLeft;

  const upper = brand.trim().toUpperCase();
  const ruleH = mmToPx(2, dpi);
  const setFont = (px: number, part: "brand" | "name") => {
    // Брэнд нимгэн (400), нэр тод — бүдүүлэхийн оронд хэмжээгээр нь
    // тодруулна (клиент, 2026-11: «бүдүүн үзэмжгүй»).
    ctx.font = font(px, part === "name");
    ctx.letterSpacing = part === "brand" ? `${BRAND_TRACKING * px}px` : "0px";
  };
  const { brandPx, namePx, nameLines } = perfumeLabelLayout({
    brand: upper,
    name,
    maxWidth: maxW,
    maxHeight: h - padY * 2,
    startPx: ptToPx(paper.fontPt, dpi) * 1.05,
    lineGap: LINE_GAP,
    ruleHeight: ruleH,
    brandRatio: 0.72,
    measure: (s, px, part) => {
      setFont(px, part);
      return ctx.measureText(s).width;
    },
  });

  const total =
    brandPx * LINE_GAP + ruleH + nameLines.length * namePx * LINE_GAP;
  let y = Math.max(padY, (h - total) / 2);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  setFont(brandPx, "brand");
  // letterSpacing сүүлийн үсгийн ард ч зай нэмдэг — голлуулахад нөхнө.
  ctx.fillText(upper, cx + (BRAND_TRACKING * brandPx) / 2, y);
  y += brandPx * LINE_GAP;

  // ──◆── зураас
  const ruleY = y + ruleH / 2;
  const half = Math.min(mmToPx(8, dpi), maxW / 2 - mmToPx(1, dpi));
  const gap = mmToPx(0.9, dpi);
  const thick = Math.max(2, mmToPx(0.18, dpi));
  ctx.fillRect(cx - half, ruleY - thick / 2, half - gap, thick);
  ctx.fillRect(cx + gap, ruleY - thick / 2, half - gap, thick);
  const d = mmToPx(0.55, dpi);
  ctx.beginPath();
  ctx.moveTo(cx, ruleY - d);
  ctx.lineTo(cx + d, ruleY);
  ctx.lineTo(cx, ruleY + d);
  ctx.lineTo(cx - d, ruleY);
  ctx.closePath();
  ctx.fill();
  y += ruleH;

  setFont(namePx, "name");
  for (const line of nameLines) {
    ctx.fillText(line, cx, y);
    y += namePx * LINE_GAP;
  }
  ctx.letterSpacing = "0px";
  return canvas;
}

/**
 * Усны хуудас (40×30): хос цаасны дээд, доод шошгонд нэг нэг ус. Сондгой
 * тоотой бол сүүлийн хуудасны доод шошго хоосон үлдэнэ.
 */
export function drawPerfumePage(
  labels: readonly { brand: string; name: string; ml?: number | null }[],
  dpi: number,
  logo: LabelLogo | null,
): HTMLCanvasElement {
  const { widthMm, heightMm, perPage } = LABEL_PAPERS.perfume;
  const { canvas, ctx } = newCanvas(
    { widthMm, heightMm: heightMm * perPage },
    dpi,
  );
  const slot = canvas.height / perPage;
  labels.slice(0, perPage).forEach((l, i) => {
    ctx.drawImage(
      drawPerfumeLabel(l.brand, l.name, dpi, logo, l.ml),
      0,
      Math.round(i * slot),
    );
  });
  return canvas;
}

/**
 * Цэвэр хар/цагаан болгоно. Сангийн encoder цагаанаас бусад БҮХ пикселийг
 * хар гэж үздэг тул antialias-ийн саарал ирмэг хар болж, лого ба текст
 * тодорч (bold) хэвлэгддэг байв. 50%-ийн босгоор таслах нь эх хэлбэрийг
 * хадгална.
 */
export function binarize(canvas: HTMLCanvasElement, threshold = 128): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function ellipsize(
  line: string,
  maxW: number,
  measure: (s: string) => number,
): string {
  let s = line;
  while (s.length > 1 && measure(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

export interface PrintJob {
  /** Амжилттай хэвлэгдвэл буцаах түлхүүр (жишээ нь захиалгын id). */
  key: string;
  /** Алдааны мэдэгдэлд. */
  label: string;
  draw: (dpi: number) => HTMLCanvasElement;
}

export interface PrintResult {
  printed: string[];
  error: string | null;
  /** «Зогсоох» дарагдсан — үлдсэн шошго хэвлэгдээгүй. */
  stopped: boolean;
}

/**
 * Шошго бүрийг тусдаа print task-аар хэвлэнэ — алдаа гарвал аль нь гарсныг
 * яг мэдэж, зөвхөн хэвлэгдсэнийг буцаана.
 *
 * Эргүүлэлт: шошгоны өргөн толгойд (printhead) багтвал шууд («top»), эс
 * бөгөөс 90° («left») — 45×60 B21-д шууд, 40×15 D11-д хажуугаар гарна.
 *
 * `signal` — «Зогсоох»: хэвлэгдэж буй шошгыг дуусгаад (хагас хэвлэгдсэн
 * шошго цаас гацаадаг тул дундаас нь тасалдаггүй) дараагийнхыг эхлүүлэхгүй.
 */
export async function printLabels(
  jobs: PrintJob[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PrintResult> {
  const lib = await import("@mmote/niimbluelib");
  const c = client;
  if (!c?.isConnected()) throw new Error("Хэвлэгч холбогдоогүй байна");
  const taskName = c.getPrintTaskType();
  if (!taskName) {
    throw new Error(
      "Энэ хэвлэгчийн загварыг таньсангүй (дэмжигдэхгүй байж магадгүй)",
    );
  }
  const meta = c.getModelMetadata();
  const dpi = meta?.dpi ?? 203;
  const head = meta?.printheadPixels;

  const printed: string[] = [];
  for (const [i, job] of jobs.entries()) {
    if (signal?.aborted) return { printed, error: null, stopped: true };
    try {
      const canvas = job.draw(dpi);
      binarize(canvas);
      let direction: PrintDirection = meta?.printDirection ?? "left";
      if (head) {
        if (canvas.width <= head) direction = "top";
        else if (canvas.height <= head) direction = "left";
        else throw new Error("Шошго хэвлэгчийн толгойноос өргөн байна");
      }
      const image = lib.ImageEncoder.encodeCanvas(
        canvas,
        lib.PageColorType.SingleColor,
        direction,
      );
      const task = c.protocol.newPrintTask(taskName, {
        totalPages: 1,
        density: meta?.densityDefault,
        labelType: lib.LabelType.WithGaps,
        statusPollIntervalMs: 100,
        statusTimeoutMs: 8_000,
      });
      try {
        await task.printInit();
        await task.printPage(image, 1);
        await task.waitForFinished();
      } finally {
        await task.printEnd().catch(() => undefined);
      }
      printed.push(job.key);
      onProgress?.(i + 1, jobs.length);
    } catch (e) {
      return {
        printed,
        error: `${job.label}: ${e instanceof Error ? e.message : String(e)}`,
        stopped: false,
      };
    }
  }
  return { printed, error: null, stopped: false };
}
