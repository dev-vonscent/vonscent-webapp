# vonscent — Баримт бичиг

Төслийн техникийн баримтыг сэдвээр нь бүлэглэв.

## 📁 Бүтэц

### `spec/` — Шаардлага ба архитектур
| Файл | Тайлбар |
|---|---|
| [requirement.md](./spec/requirement.md) | Үндсэн шаардлага (хуудас бүрийн функц) |
| [requirement_fb.md](./spec/requirement_fb.md) | Клиентийн нэмэлт санал |
| [requirement_fb_gap_analysis.md](./spec/requirement_fb_gap_analysis.md) | Санал ↔ хэрэгжилтийн зөрүүний шинжилгээ |
| [collection-requirement.md](./spec/collection-requirement.md) | Багц (Collection) функцийн бүрэн шаардлага + UI/UX |
| [ai-image-generation-requirement.md](./spec/ai-image-generation-requirement.md) | AI (gpt-image-1) барааны зураг үүсгэх функцийн шаардлага |
| [note-images.md](./spec/note-images.md) | Үнэрийн нотын зураг — prompt, багц скрипт, шинэ бараа нэмэх үеийн авто урсгал |
| [design.md](./spec/design.md) | Дизайн систем, токен |
| [development.md](./spec/development.md) | Хөгжүүлэлтийн архитектур, дүрэм |

### `planning/` — Төлөвлөгөө
| Файл | Тайлбар |
|---|---|
| [roadmap.md](./planning/roadmap.md) | 8 фазын замын зураг |
| [todo.md](./planning/todo.md) | Хийх ажлын жагсаалт (гүйцэтгэлийн төлөв) |
| [valuation.md](./planning/valuation.md) | Үнэлгээ / өртөг |

### `import/` — Дата импортын заавар ба загвар
| Файл | Тайлбар |
|---|---|
| [product-import-guide.md](./import/product-import-guide.md) | Бараа импортлох заавар |
| [product-import-template.csv](./import/product-import-template.csv) | Барааны CSV загвар |
| real-product-list.xlsx | Клиентээс ирсэн бодит барааны жагсаалт (75 бараа) |
| [collection-import-guide.md](./import/collection-import-guide.md) | Багц импортлох заавар |
| [collection-import-template.xlsx](./import/collection-import-template.xlsx) | Багцын хоосон Excel загвар |
| [collection-import-sample.xlsx](./import/collection-import-sample.xlsx) | Бөглөсөн жишээ (3 багц) |
| [admin-image-guide.md](./import/admin-image-guide.md) | Админ зураг оруулах заавар |

### `delivery/` — Хүргэлтийн бүс
| Файл | Тайлбар |
|---|---|
| [delivery-zones-guide.md](./delivery/delivery-zones-guide.md) | Хүргэлтийн бүс тохируулах заавар |
| [delivery-zones-ub-template.csv](./delivery/delivery-zones-ub-template.csv) | УБ хорооны загвар |
| [delivery-zones-rural-template.csv](./delivery/delivery-zones-rural-template.csv) | Орон нутгийн загвар |
| Delivery Zones Template.xlsx | Excel загвар |
| shipping-settings.json | `scripts/build-shipping-settings.ts`-ээс үүсдэг (CSV → тохиргоо) |

## Түгээмэл командууд

```bash
# Бараа импортлох (эхлээд --dry-аар шалгах; --active-гүй бол нуугдмал орно)
pnpm db:import-products docs/import/real-product-list.xlsx --dry
pnpm db:import-products docs/import/real-product-list.xlsx

# Брэндийн лого олж public/brands-д хийгээд DB-д холбох
node --env-file=.env --import tsx scripts/fetch-brand-logos.ts --review   # шалгах
node --env-file=.env --import tsx scripts/fetch-brand-logos.ts --write
node --env-file=.env --import tsx scripts/set-brand-logos.ts

# Барааны дэлгэрэнгүй (нот, танилцуулга, зураг) нөхөх
node --env-file=.env --import tsx scripts/harvest-parfumo.ts
node --import tsx scripts/build-enrichment.ts
pnpm db:enrich-products docs/import/enrichment/manifest.json

# Багц импортлох (эхлээд --dry-аар шалгах)
pnpm db:import-collections docs/import/collection-import-template.xlsx --dry
pnpm db:import-collections docs/import/collection-import-template.xlsx

# Хүргэлтийн CSV-үүдээс тохиргоо үүсгэх
node --import tsx scripts/build-shipping-settings.ts
```
