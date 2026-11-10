import "server-only";

/**
 * Картын PNG (next/og, satori)-д кирилл фонт. Satori woff2 уншдаггүй, харин
 * Google Fonts нь User-Agent-гүй хүсэлтэд TTF буцаадаг. Instance бүрт нэг л
 * удаа татна; унавал фонтгүй (default) зурна — зураг гарахгүй байснаас дээр.
 */
const cache = new Map<number, Promise<ArrayBuffer | null>>();

async function fetchInter(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`,
      { cache: "force-cache" },
    ).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/u)?.[1];
    if (!url) return null;
    const res = await fetch(url, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function interFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
> {
  const weights = [400, 700] as const;
  const loaded = await Promise.all(
    weights.map((w) => {
      let p = cache.get(w);
      if (!p) {
        p = fetchInter(w);
        cache.set(w, p);
        // Алдаатай бол дараагийн хүсэлт дахин оролдоно.
        void p.then((d) => d ?? cache.delete(w));
      }
      return p;
    }),
  );
  return weights.flatMap((w, i) => {
    const data = loaded[i];
    return data ? [{ name: "Inter", data, weight: w, style: "normal" as const }] : [];
  });
}
