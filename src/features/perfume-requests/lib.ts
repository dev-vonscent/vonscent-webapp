/**
 * Хайлтын үгнээс формын урьдчилсан утга: эхэндээ мэдэгдэж буй брэндийн нэр
 * байвал («dior sauvage» → Dior + sauvage) салгана, эс бөгөөс бүгд нэр.
 * Хамгийн урт брэнд түрүүлнэ («Maison Margiela» > «Maison»).
 */
export function splitSearchQuery(
  query: string,
  brands: readonly string[],
): { brand: string; name: string } {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return { brand: "", name: "" };
  const lower = q.toLowerCase();
  const hit = [...brands]
    .sort((a, b) => b.length - a.length)
    .find((b) => {
      const name = b.trim().toLowerCase();
      return name !== "" && (lower === name || lower.startsWith(`${name} `));
    });
  if (!hit) return { brand: "", name: q };
  return { brand: hit.trim(), name: q.slice(hit.trim().length).trim() };
}
