/**
 * «Үндсэн агуулга руу шилжих» холбоос (WCAG 2.4.1 Bypass Blocks).
 *
 * Толгой хэсэгт цэс, хайлт, сагс зэрэг 15 орчим товч байдаг тул гарнаас
 * ажилладаг хүн хуудас бүр дээр тэр бүгдийг Tab-аар давах шаардлагатай
 * байв. Энэ холбоос нь ердийн үед харагдахгүй, зөвхөн ФОКУС авахад л гарч
 * ирнэ — хулганаар хэрэглэгчид юу ч өөрчлөгдөхгүй.
 *
 * `display:none` эсвэл `hidden` биш — тэдгээр нь холбоосыг фокусын дараалла-
 * аас БҮРЭН хасдаг. Иймд дэлгэцээс гаргаж (`sr-only`), фокус авахад буцааж
 * оруулна (`focus:not-sr-only`).
 */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className="bg-card text-foreground focus:ring-ring sr-only rounded-md px-4 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100"
    >
      Үндсэн агуулга руу шилжих
    </a>
  );
}
