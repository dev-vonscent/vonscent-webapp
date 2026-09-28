import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

/**
 * «Өөрөө угсрах» нь хуудасны толгойд, бэлэн багцуудтай зэрэгцэн зогсоно.
 *
 * Өмнө нь энэ санал grid-ийн сүүлчийн нүд байсан. Багц цөөхөн байхад тэр нь
 * ажилладаг ч, багц олон болмогц хоёр, гурван мөрийн доор орж, төгсгөл хүртэл
 * гүйлгэсэн хүнд л харагддаг — өөрөөр хэлбэл яг л бэлэн багцаасаа тохирохыг
 * нь олоогүй хүн энэ гарцыг хамгийн сүүлд мэдэж авдаг.
 *
 * Багц угсрах нь жагсаалтын дараах алхам биш, жагсаалттай **зэрэгцээ зам**:
 * тиймээс шүүлтүүрээс ч дээр, сонголт эхлэхээс өмнө нь.
 *
 * Нэг мөр, нэг үйлдэл. Доор нь «4-с олон үнэртэн сонгоод 5% хямд» гэсэн
 * тайлбар байсныг хаслаа: нөхцөлөө угсрах хуудас дээр нь бүрэн, зөв
 * хэлдэг бөгөөд толгойд зөвхөн ЗАМ нь хэрэгтэй.
 */
export function BuildRoutePanel() {
  return (
    <Link
      href="/collections/build"
      className="group bg-secondary hover:bg-accent flex items-center gap-3 rounded-2xl p-4 transition-colors active:scale-[0.99] md:w-72 md:shrink-0"
    >
      <span className="bg-background/60 flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-out group-hover:scale-110">
        <Plus className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">
        Өөрөө багц угсрах
      </span>
      <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-[color,transform] duration-300 ease-out group-hover:translate-x-1" />
    </Link>
  );
}
