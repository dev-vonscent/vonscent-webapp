# VONSCENT — Хийх ажлын жагсаалт

Зөвхөн **хийгдээгүй** ажил. Хийгдсэн ажлын түүх git-д (`git log -- docs/planning/todo.md`).

**Тэмдэглэгээ:** `[ ]` хийгээгүй · 🟢 DB өөрчлөлт шаардахгүй · 🔵 DB migration шаардана

---

## Хийх
- [ ] **Instagram жинхэнэ feed**.
- [ ] 🔵 **Бүтэн сав (50/100ml) зарах загвар**.
- [ ] 🟢 **Sentry cron monitor — `reconcile-payments`** (2026-10-05 хойшлуулсан).
      `/api/cron/reconcile-payments` (5 мин тутам, `vercel.json`) нь төлбөрийн
      сүүлчийн хамгаалалт: callback алдагдаж хэрэглэгч browser-оо хаавал
      захиалгыг цуцлахаас өмнө QPay-ээс нэг удаа асууна. Cron огт ажиллахгүй
      болох, эсвэл 401/503 буцаах нь exception биш тул Error Monitor барихгүй —
      «мөнгө орсон, захиалга цуцлагдсан» чимээгүй алдаа. Хийх: route-ийг
      `Sentry.withMonitor("reconcile-payments", …, { schedule: "*/5 * * * *" })`-ээр
      боох (автомат Vercel cron холболт App Router-т ажилладаггүй) → Sentry
      Monitors → Cron-д гарч ирсний дараа «Alert on specific monitors» → Discord
      `#sentry` alert холбох. 2026-10-05-нд Vercel log-оор 5 мин тутам 200 —
      одоогоор хэвийн.

