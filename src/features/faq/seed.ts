export interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

/** Group a flat FAQ list by category, preserving first-seen order. */
export function groupFaqs(
  items: FaqItem[],
): { title: string; items: FaqItem[] }[] {
  const map = new Map<string, FaqItem[]>();
  for (const item of items) {
    const arr = map.get(item.category) ?? [];
    arr.push(item);
    map.set(item.category, arr);
  }
  return [...map.entries()].map(([title, items]) => ({ title, items }));
}

/** Seed FAQ used in demo mode and by the DB seed (admin can edit live). */
export const FAQ_SEED: FaqItem[] = [
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
