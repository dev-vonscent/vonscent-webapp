import { PhotoTile } from "@/components/shared/photo-tile";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";

/**
 * Hero-гийн доорх хүйсний товчлол — ЗӨВХӨН УТСАН ДЭЭР. Desktop-д ижил
 * сонголт каталог цэсэнд (`CatalogMenu`) байгаа тул давтахгүй; утсан дээр
 * тэр цэс байхгүй. Каталог цэстэй ижил зураг, хар цагаан (`revealColor`).
 * Product card БИШ — дарахад жагсаалт руу орно.
 */
export function HomeShortcuts() {
  return (
    <nav aria-label="Товч замууд" className="md:hidden">
      <ul className="grid grid-cols-3 gap-2">
        {GENDERS.map((g) => (
          <li key={g}>
            <PhotoTile
              href={`/catalog?gender=${g}`}
              src={`/gender-${g}.webp`}
              label={GENDER_LABEL[g]}
              sizes="33vw"
              className="aspect-3/4"
              labelClassName="bottom-2 left-2.5 text-sm"
              revealColor
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
