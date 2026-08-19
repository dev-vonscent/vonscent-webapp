import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, Sparkles, Truck, Heart } from "lucide-react";
import { getAboutSettings } from "@/features/content/api";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Бидний тухай",
  description: "vonscent — үнэртэн decant хэлбэрээр туршиж сонгох дэлгүүр.",
};

const VALUES = [
  {
    icon: BadgeCheck,
    title: "Жинхэнэ бараа",
    desc: "Зөвхөн албан ёсны эх сурвалжаас. Хуурамч бараа байхгүй.",
  },
  {
    icon: Sparkles,
    title: "Туршиж сонгох",
    desc: "5/10/20мл багцаар хэд хэдэн үнэр туршаад дуртайгаа ол.",
  },
  {
    icon: Truck,
    title: "Найдвартай хүргэлт",
    desc: "Улаанбаатар хотод шуурхай, орон нутагт найдвартай.",
  },
  {
    icon: Heart,
    title: "Анхааралтай үйлчилгээ",
    desc: "Үнэр сонгоход тань туслах баг ажиллана.",
  },
];

export default async function AboutPage() {
  const about = await getAboutSettings();
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-8 py-16">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Бидний тухай
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
          Үнэрээ том савыг авалгүй ол
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          {about.story ||
            "vonscent нь дэлхийн шилдэг үнэртнүүдийг жижиг (decant) багцаар санал болгодог. Бид итгэдэг — үнэр бол хувь хүний илэрхийлэл. Бүтэн сав худалдан авахаасаа өмнө өөрт тань яг тохирохыг нь олох ёстой."}
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {VALUES.map((v) => (
          <div
            key={v.title}
            className="flex gap-4 rounded-lg border border-border p-6"
          >
            <v.icon className="size-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-serif text-lg font-semibold">{v.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-xl bg-secondary p-8 text-center sm:p-12">
        <h2 className="font-serif text-2xl font-semibold">
          Decant гэж юу вэ?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Decant гэдэг нь үйлдвэрийн бүтэн савнаас жижиг саванд хувааж хийсэн эх
          үнэртэн юм. Найрлага яг адил — зөвхөн хэмжээ нь бага. Ингэснээр та цөөн
          төгрөгөөр олон үнэр туршиж, дуртайгаа олох боломжтой.
        </p>
      </div>

      {about.team.length > 0 && (
        <div className="mt-16">
          <h2 className="text-center font-serif text-2xl font-semibold">
            Манай баг
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {about.team.map((m) => (
              <div key={m.name} className="text-center">
                <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-full border border-border bg-secondary">
                  {m.image ? (
                    <Image
                      src={m.image}
                      alt={m.name}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-2xl text-muted-foreground">
                      {m.name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="mt-3 font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
