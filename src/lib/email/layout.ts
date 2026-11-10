/**
 * Захидлын нэгдсэн загвар — бүх гарах имэйл (захиалгын мэдэгдэл, дэлгүүрийн
 * дотоод мэдэгдэл) энэ нэг функцээр дамжина. HTML болон plain-text хувилбарыг
 * НЭГ өгөгдлөөс зэрэг гаргадаг тул хоёр нь хэзээ ч зөрөхгүй.
 *
 * Дизайн: имэйл клиентүүд орчин үеийн CSS дэмждэггүй тул table + inline style.
 * Өнгө нь дизайн системийн light палитраас (`globals.css`) — gradient байхгүй.
 * Имэйл клиент dark mode-д өөрөө хөрвүүлдэг тул нэг л (цайвар) хувилбартай.
 */

export type EmailItem = {
  /** Барааны нэр, аль хэдийн уншигдахуйц болсон байх (жишээ: "Dior Sauvage") */
  name: string;
  /** Жижиг тайлбар мөр — хэмжээ, тоо ширхэг гэх мэт */
  meta?: string;
  /** Мөрийн дүн, форматлагдсан текст */
  amount: string;
};

export type EmailLine = {
  label: string;
  value: string;
  /** Нийт дүн шиг онцлох мөр */
  strong?: boolean;
};

export type EmailDoc = {
  /** Inbox-д гарчгийн ард харагдах богино мөр */
  preheader: string;
  heading: string;
  /** Үндсэн догол мөрүүд */
  paragraphs: string[];
  items?: EmailItem[];
  lines?: EmailLine[];
  /** Онцолсон тэмдэглэл (буцаалт, анхааруулга) */
  note?: string;
  cta?: { label: string; href: string };
  /** Хаягийн доорх нэмэлт мөрүүд */
  footerNotes?: string[];
  /** Байвал footer-т «мэдэгдэл авахаа болих» линк нэмнэ */
  unsubscribeUrl?: string;
  /**
   * Гарчгийн дээрх том зураг (бэлгийн карт). Hosted https URL — data URI-г
   * Gmail/Outlook хаадаг. `href` өгвөл зураг өөрөө линк.
   */
  hero?: { src: string; alt: string; width: number; height: number; href?: string };
  /** CTA-ийн доорх том, хуулахад хялбар код (бэлгийн код). */
  code?: { label: string; value: string };
  /** Дугаартай алхмууд — «Хэрхэн ашиглах вэ». */
  steps?: { title: string; items: string[] };
  /** Жижиг зураг + тайлбар (QR) — имэйлийг компьютерээс нээсэн үед утсаар. */
  qr?: { src: string; alt: string; caption: string };
};

const BRAND = "vonscent";
const C = {
  page: "#f4f4f4",
  card: "#ffffff",
  text: "#0a0a0a",
  muted: "#5f5f5f",
  rule: "#e8e8e8",
  cta: "#171717",
  ctaText: "#ffffff",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Зөвхөн http(s) линкийг зөвшөөрнө — `javascript:` гэх мэт хаягийг таслана. */
function safeHref(href: string): string {
  return /^https?:\/\//i.test(href) ? escapeHtml(href) : "#";
}

export function renderEmail(doc: EmailDoc): { html: string; text: string } {
  return { html: renderHtml(doc), text: renderText(doc) };
}

function renderHtml(doc: EmailDoc): string {
  const p = (text: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.text}">` +
    `${escapeHtml(text)}</p>`;

  const items = doc.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse;margin:20px 0 4px">` +
      doc.items
        .map(
          (it) =>
            `<tr>` +
            `<td style="padding:10px 0;border-top:1px solid ${C.rule};font-size:14px;` +
            `line-height:1.5;color:${C.text}">${escapeHtml(it.name)}` +
            (it.meta
              ? `<br><span style="font-size:13px;color:${C.muted}">${escapeHtml(it.meta)}</span>`
              : "") +
            `</td>` +
            `<td align="right" style="padding:10px 0;border-top:1px solid ${C.rule};` +
            `font-size:14px;color:${C.text};white-space:nowrap;vertical-align:top">` +
            `${escapeHtml(it.amount)}</td>` +
            `</tr>`,
        )
        .join("") +
      `</table>`
    : "";

  const lines = doc.lines?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse;margin:16px 0 4px">` +
      doc.lines
        .map((ln) => {
          const weight = ln.strong ? "600" : "400";
          const color = ln.strong ? C.text : C.muted;
          const top = ln.strong ? `border-top:1px solid ${C.rule};` : "";
          return (
            `<tr>` +
            `<td style="${top}padding:6px 0;font-size:14px;color:${color};` +
            `font-weight:${weight}">${escapeHtml(ln.label)}</td>` +
            `<td align="right" style="${top}padding:6px 0;font-size:14px;color:${C.text};` +
            `font-weight:${weight};white-space:nowrap">${escapeHtml(ln.value)}</td>` +
            `</tr>`
          );
        })
        .join("") +
      `</table>`
    : "";

  const note = doc.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse;margin:18px 0 4px">` +
      `<tr><td style="background:${C.page};border-radius:8px;padding:14px 16px;` +
      `font-size:14px;line-height:1.6;color:${C.text}">${escapeHtml(doc.note)}</td></tr>` +
      `</table>`
    : "";

  const cta = doc.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px">` +
      `<tr><td style="background:${C.cta};border-radius:8px">` +
      `<a href="${safeHref(doc.cta.href)}" style="display:inline-block;padding:12px 22px;` +
      `font-size:14px;font-weight:600;color:${C.ctaText};text-decoration:none">` +
      `${escapeHtml(doc.cta.label)}</a></td></tr></table>`
    : "";

  const hero = doc.hero
    ? (() => {
        const img =
          `<img src="${safeHref(doc.hero.src)}" alt="${escapeHtml(doc.hero.alt)}" ` +
          `width="${doc.hero.width}" height="${doc.hero.height}" ` +
          `style="display:block;width:100%;max-width:${doc.hero.width}px;height:auto;` +
          `border:0;border-radius:10px">`;
        return (
          `<div style="margin:0 0 22px">` +
          (doc.hero.href
            ? `<a href="${safeHref(doc.hero.href)}" style="text-decoration:none">${img}</a>`
            : img) +
          `</div>`
        );
      })()
    : "";

  const code = doc.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse;margin:22px 0 4px">` +
      `<tr><td align="center" style="border:1px dashed ${C.rule};border-radius:10px;padding:16px">` +
      `<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;` +
      `color:${C.muted}">${escapeHtml(doc.code.label)}</p>` +
      `<p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:24px;` +
      `font-weight:600;letter-spacing:0.12em;color:${C.text}">${escapeHtml(doc.code.value)}</p>` +
      `</td></tr></table>`
    : "";

  const steps = doc.steps?.items.length
    ? `<p style="margin:26px 0 10px;font-size:15px;font-weight:600;color:${C.text}">` +
      `${escapeHtml(doc.steps.title)}</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="border-collapse:collapse">` +
      doc.steps.items
        .map(
          (step, i) =>
            `<tr><td valign="top" style="padding:6px 12px 6px 0;width:28px">` +
            `<div style="width:24px;height:24px;line-height:24px;border-radius:12px;` +
            `background:${C.page};text-align:center;font-size:13px;font-weight:600;` +
            `color:${C.text}">${i + 1}</div></td>` +
            `<td style="padding:6px 0;font-size:14px;line-height:1.6;color:${C.text}">` +
            `${escapeHtml(step)}</td></tr>`,
        )
        .join("") +
      `</table>`
    : "";

  const qr = doc.qr
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px">` +
      `<tr><td style="padding-right:14px">` +
      `<img src="${safeHref(doc.qr.src)}" alt="${escapeHtml(doc.qr.alt)}" width="96" ` +
      `height="96" style="display:block;border:0"></td>` +
      `<td style="font-size:13px;line-height:1.6;color:${C.muted}">` +
      `${escapeHtml(doc.qr.caption)}</td></tr></table>`
    : "";

  const footerLines = [...(doc.footerNotes ?? [])].map(
    (line) =>
      `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${C.muted}">` +
      `${escapeHtml(line)}</p>`,
  );
  if (doc.unsubscribeUrl) {
    footerLines.push(
      `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${C.muted}">` +
        `Мэдэгдэл авахаа болих: ` +
        `<a href="${safeHref(doc.unsubscribeUrl)}" style="color:${C.muted}">энд дарна уу</a>` +
        `</p>`,
    );
  }

  return (
    `<!doctype html><html lang="mn"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(doc.heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:${C.page};font-family:${FONT}">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0">` +
    `${escapeHtml(doc.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;background:${C.page};padding:24px 12px">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:collapse;max-width:560px;background:${C.card};border-radius:12px">` +
    `<tr><td style="padding:28px 28px 8px">` +
    `<p style="margin:0 0 20px;font-size:18px;font-weight:600;letter-spacing:0.08em;` +
    `text-transform:uppercase;color:${C.text}">${BRAND}</p>` +
    hero +
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600;` +
    `color:${C.text}">${escapeHtml(doc.heading)}</h1>` +
    doc.paragraphs.map(p).join("") +
    items +
    lines +
    note +
    cta +
    code +
    steps +
    qr +
    `</td></tr>` +
    `<tr><td style="padding:20px 28px 26px">` +
    `<div style="height:1px;background:${C.rule};margin-bottom:16px"></div>` +
    footerLines.join("") +
    `</td></tr></table>` +
    `</td></tr></table></body></html>`
  );
}

function renderText(doc: EmailDoc): string {
  const parts: string[] = [doc.heading, ""];
  parts.push(...doc.paragraphs, "");

  if (doc.items?.length) {
    for (const it of doc.items) {
      parts.push(`· ${it.name}${it.meta ? ` — ${it.meta}` : ""}: ${it.amount}`);
    }
    parts.push("");
  }
  if (doc.lines?.length) {
    for (const ln of doc.lines) parts.push(`${ln.label}: ${ln.value}`);
    parts.push("");
  }
  if (doc.note) parts.push(doc.note, "");
  if (doc.cta) parts.push(`${doc.cta.label}: ${doc.cta.href}`, "");
  if (doc.code) parts.push(`${doc.code.label}: ${doc.code.value}`, "");
  if (doc.steps?.items.length) {
    parts.push(doc.steps.title);
    doc.steps.items.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
    parts.push("");
  }

  parts.push("—");
  parts.push(...(doc.footerNotes ?? []));
  if (doc.unsubscribeUrl) {
    parts.push(`Мэдэгдэл авахаа болих: ${doc.unsubscribeUrl}`);
  }

  return parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
