import { FAQ_CATEGORIES, type FaqCategory } from "@/lib/constants";

export interface FaqItem {
  /** DB-ийн хуучин мөр өөр ангилалтай байж болох тул `string` ч зөвшөөрнө. */
  category: FaqCategory | (string & {});
  question: string;
  answer: string;
}

/**
 * Group a flat FAQ list by category: the fixed `FAQ_CATEGORIES` first, in
 * their order, then any legacy category in first-seen order.
 */
export function groupFaqs(
  items: FaqItem[],
): { title: string; items: FaqItem[] }[] {
  const map = new Map<string, FaqItem[]>();
  for (const item of items) {
    const arr = map.get(item.category) ?? [];
    arr.push(item);
    map.set(item.category, arr);
  }
  const rank = (c: string) => {
    const i = (FAQ_CATEGORIES as readonly string[]).indexOf(c);
    return i < 0 ? FAQ_CATEGORIES.length : i;
  };
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([title, items]) => ({ title, items }));
}

/** Seed FAQ used in demo mode and by the DB seed (admin can edit live). */
export const FAQ_SEED: (FaqItem & { category: FaqCategory })[] = [
  {
    category: "Бараа",
    question: "Decant бараа жинхэнэ юу?",
    answer:
      "Тийм. Бид зөвхөн албан ёсны эх сурвалжаас авсан жинхэнэ үнэртнийг жижиг саванд хувааж санал болгодог.",
  },
  {
    category: "Бараа",
    question: "5, 10, 20мл ялгаа юу вэ?",
    answer:
      "Зөвхөн хэмжээний ялгаа. Найрлага ижил. Бага хэмжээ нь туршихад, их хэмжээ нь тогтмол хэрэглэхэд тохиромжтой.",
  },
  {
    category: "Захиалга & Төлбөр",
    question: "Хэрхэн төлбөр төлөх вэ?",
    answer:
      "QPay-ээр QR уншуулж эсвэл банкны шилжүүлгээр төлөх боломжтой. Захиалга баталгаажмагц зааврыг харуулна.",
  },
  {
    category: "Захиалга & Төлбөр",
    question: "Захиалгаа хэрхэн хянах вэ?",
    // Rich text: `sanitizeHtml` нь `<a href>`-ийг зөвшөөрдөг тул хариулт
    // дотроос шууд хайлтын хуудас руу орж болно.
    answer:
      '<p>Бүртгэлтэй бол <a href="/account/orders">Миний захиалга</a> хэсгээс ' +
      'харна. Зочноор захиалсан бол <a href="/order/find">Захиалга хайх</a> ' +
      "хуудсанд захиалгын дугаар (VS-...) болон утасны дугаараа бичихэд " +
      "захиалгын төлөв харагдана. Баталгаажуулах имэйл дотор ч шууд холбоос " +
      "ирнэ.</p>",
  },
  {
    category: "Захиалга & Төлбөр",
    question: "Захиалгаа цуцлах боломжтой юу?",
    answer:
      "Төлбөр хийгдэхээс өмнө цуцлах боломжтой. Бэлтгэгдсэн захиалгын хувьд бидэнтэй холбогдоно уу.",
  },
  {
    category: "Хүргэлт",
    question: "Хэдэн хоногт хүрэх вэ?",
    answer:
      "Улаанбаатар хотод 24 цагийн дотор, орон нутагт 2-4 хоногт хүргэнэ.",
  },
  {
    category: "Хүргэлт",
    question: "Хүргэлтийн төлбөр хэд вэ?",
    answer:
      "Хүргэлтийн төлбөр бүсээсээ хамаарна — checkout дээр хаягаа оруулмагц харагдана. Хүргүүлэх өдрөө checkout дээр сонгоно (хамгийн эрт нь маргааш), тэр өдрийн 11:00 цагт хүргэлтэд гарна.",
  },
];
