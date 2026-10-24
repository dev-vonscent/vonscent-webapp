import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getScentFamilies } from "@/features/taxonomy/api";
import { GENDERS, GENDER_LABEL, SEASON_LABEL } from "@/lib/constants";
import { PhotoTile } from "@/components/shared/photo-tile";
import { cn } from "@/lib/utils";

/** Улирлын шүүлтүүр — «Бүх улирал» ус бүх сонголтод автоматаар орно. */
const MENU_SEASONS = ["spring", "summer", "autumn", "winter"] as const;
const SEASON_IMAGE: Record<(typeof MENU_SEASONS)[number], string> = {
  spring: "/season-spring.jpg",
  summer: "/season-summer.jpg",
  autumn: "/season-autumn.jpg",
  winter: "/season-winter.jpg",
};

/**
 * Desktop header-ийн «Каталог» цэсний агуулга (server). Нээх/хаах нь
 * `SiteHeader`-ийн client хэсэгт; энд зөвхөн каталогийн шүүлтүүр рүү
 * заасан холбоосууд. Бүх холбоос нь каталогийн одоо байгаа query
 * (`parseFilters`) — шинэ хуудас нэмээгүй.
 *
 * Зүүнээс: үнэрийн төрөл (transparent дүрстэй жагсаалт + «Бүх үнэртэн») ·
 * хүйс · улирал (нэр нь дээрээ бичигдсэн зургийн карт). Бичигтэй хэсэг нэг
 * талд, зурагтай хоёр блок нөгөө талд нэг эгнээ болж уншигдана. Брэнд энд биш, нүүрний брэндийн ханад
 * (`BrandMarquee`) — тоо нь өсөхөд цэс өндөрсөхгүй.
 */
export async function CatalogMenu() {
  const families = await getScentFamilies();

  const allLink = (
    <Link
      href="/catalog"
      className="hover:text-gold-strong inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
    >
      Бүх үнэртэн үзэх
      <ArrowRight className="size-4" />
    </Link>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.15fr)] gap-10">
      {families.length > 0 ? (
        <MenuColumn id="family" title="Үнэрийн төрөл">
          {/* 3×2 «дүрсний тавиур»: дүрс дээр, нэр доор нь — хажуугийн зурагтай
              картуудтай ижил босоо хэмнэлтэй. Дүрсүүд transparent PNG, дэвсгэргүй;
              hover-оор л нүд тодорч дүрс бага зэрэг өргөгдөнө. Админы шинээр
              нэмсэн төрөлд дүрс хараахан байхгүй байж болно. */}
          <ul className="grid grid-cols-3 gap-2">
            {families.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/catalog?family=${f.slug}`}
                  className="group hover:bg-secondary flex h-25 flex-col items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors"
                >
                  <span className="flex size-14 items-center justify-center">
                    {f.iconUrl && (
                      <Image
                        src={f.iconUrl}
                        alt=""
                        width={56}
                        height={56}
                        // 512px эх зургийг 56px болгож браузер өөрөө 9 дахин
                        // жижигрүүлбэл hover/нээх animation-ы үеэр Chrome бүдүүн
                        // чанараар, дуусахад нарийн чанараар дахин зурж дүрс
                        // анивчдаг байв — Next жижиг хувилбар өгнө. SVG-г
                        // `dangerouslyAllowSVG`-гүйгээр optimize хийхгүй.
                        unoptimized={f.iconUrl.endsWith(".svg")}
                        className="size-14 object-contain will-change-transform transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none"
                      />
                    )}
                  </span>
                  {f.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">{allLink}</div>
        </MenuColumn>
      ) : (
        <div className="self-end">{allLink}</div>
      )}

      {/* Хүйс + улирал нэг дотоод grid-д: багана бүр `subgrid`-ээр шошго /
          картын хоёр мөрийг хуваалцана. Хүйсийн карт `aspect-3/4` тул мөрийн
          өндрийг тэр тогтооно, улирлын 2×2 нь тэр өндрийг дүүргэнэ — дэлгэц
          өргөсөхөд харьцаа хэвээр, зураг тайрагдахгүй (тогтмол `h-*` байхад
          өргөн дэлгэц дээр картууд хэт өргөсөж толгой тасардаг байсан).
          `self-start`: сунгавал auto мөрүүд илүү зайг хувааж, улирлын мөр
          хүйсийнхээс өндөр болно. */}
      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-10 self-start">
        <MenuColumn
          id="gender"
          title="Хүйс"
          className="row-span-2 grid grid-rows-subgrid"
        >
          <ul className="grid grid-cols-3 gap-2">
            {GENDERS.map((g) => (
              <li key={g}>
                <PhotoTile
                  href={`/catalog?gender=${g}`}
                  src={`/gender-${g}.webp`}
                  label={GENDER_LABEL[g]}
                  sizes="200px"
                  className="aspect-3/4"
                  imageClassName="object-[50%_20%]"
                  revealColor
                />
              </li>
            ))}
          </ul>
        </MenuColumn>

        <MenuColumn
          id="season"
          title="Улирал"
          className="row-span-2 grid grid-rows-subgrid"
        >
          <ul className="grid h-full grid-cols-2 grid-rows-2 gap-2">
            {MENU_SEASONS.map((s) => (
              <li key={s}>
                <PhotoTile
                  href={`/catalog?season=${s}`}
                  src={SEASON_IMAGE[s]}
                  label={SEASON_LABEL[s]}
                  sizes="260px"
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        </MenuColumn>
      </div>
    </div>
  );
}

/**
 * Баганын нэр нь гарчиг биш, шошго: цэс header дотор байгаа тул h2 болговол
 * хуудас бүрийн гарчгийн бүтэц (h1-ээс өмнө) эвдэрнэ. `role="group"` +
 * `aria-labelledby` нь дэлгэц уншигчид бүлгийн нэрийг хэвээр хэлнэ.
 */
function MenuColumn({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const labelId = `catalog-menu-${id}`;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("min-w-0", className)}
    >
      <p
        id={labelId}
        className="text-muted-foreground mb-3 text-[11px] font-medium tracking-[0.18em] uppercase"
      >
        {title}
      </p>
      {children}
    </div>
  );
}
