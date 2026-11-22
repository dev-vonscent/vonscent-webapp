import type { ExtraDraft } from "../components/admin/extra-draft";
import type { VialOption } from "../types";

/**
 * Маягтын «Нийтлэх» товчны доорх дутуу зүйлс (plan §7.2). SQL-ийн
 * `extras_readiness()` нь эцсийн шийдвэр; энэ нь товч идэвхжихээс өмнө
 * админд юу дутуу байгааг хэлэх толь.
 */
export function draftMissing(
  d: ExtraDraft,
  vials: readonly VialOption[],
): string[] {
  const out: string[] = [];
  if (!d.name.trim()) out.push("Нэр оруулаагүй байна");
  const priced = (p: string) => {
    const n = Number(p.replace(/[\s,]/g, ""));
    return p.trim() !== "" && Number.isFinite(n) && n > 0;
  };
  switch (d.mode) {
    case "local_quantity": {
      const active = d.variants.filter((v) => v.isActive);
      if (active.length === 0) out.push("Идэвхтэй хувилбар алга байна");
      if (active.some((v) => !priced(v.price)))
        out.push("Үнэ оруулаагүй хувилбар байна");
      break;
    }
    case "shared_vial": {
      const active = d.variants.filter((v) => v.isActive);
      if (active.length === 0) out.push("Ядаж нэг сав сонгоно уу");
      if (active.some((v) => !priced(v.price)))
        out.push("Үнэ оруулаагүй сав байна");
      const byId = new Map(vials.map((v) => [v.id, v]));
      if (active.some((v) => byId.get(v.vialId ?? "")?.onHand == null))
        out.push("Тоо оруулаагүй сав сонгогдсон байна");
      break;
    }
    case "leftover_liquid": {
      if (!d.leftover?.productId)
        out.push("Аль үнэртний шил болохыг сонгоно уу");
      const rem = Number(d.leftover?.remainingMl ?? "");
      const full = Number(d.leftover?.fullMl ?? "");
      if (!(rem > 0) || !(full > 0) || rem > full)
        out.push("Үлдсэн ба бүтэн савны хэмжээг зөв оруулна уу");
      if (!priced(d.leftoverPrice)) out.push("Үнэ оруулаагүй байна");
      break;
    }
  }
  return out;
}
