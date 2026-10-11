# vonscent — Баримт бичиг

Төслийн техникийн баримтыг сэдвээр нь бүлэглэв.

## 📁 Бүтэц

### `spec/` — Архитектур ба дизайн
| Файл | Тайлбар |
|---|---|
| [development.md](./spec/development.md) | Хөгжүүлэлтийн архитектур, дүрэм |
| [design.md](./spec/design.md) | Дизайн систем, токен, хүртээмжийн дүрэм |
| [collection-requirement.md](./spec/collection-requirement.md) | Багц (Collection) функцийн бүрэн шаардлага + UI/UX |
| [note-images.md](./spec/note-images.md) | Үнэрийн нотын зураг — prompt, багц скрипт, шинэ бараа нэмэх үеийн авто урсгал |

### `planning/` — Төлөвлөгөө
| Файл | Тайлбар |
|---|---|
| [todo.md](./planning/todo.md) | Хийх ажлын жагсаалт (гүйцэтгэлийн төлөв) |
| [bottle-lock-plan.md](./planning/bottle-lock-plan.md) | Хоосон савны түгжээ (өнгө × хэмжээ) — хэрэгжүүлэлт |
| [report-audit.md](./planning/report-audit.md) | Санхүүгийн тайлангийн аудит + тест |
| [hero-3d-performance.md](./planning/hero-3d-performance.md) | Hero 3D-ийн гүйцэтгэлийн эрсдэл, оновчлолын төлөвлөгөө (2026-10) |

### `analysis/` — Судалгаа, санаа
| Файл | Тайлбар |
|---|---|
| [questions.md](./analysis/questions.md) | Клиентийн хариултууд (бизнесийн дүрмийн шийдвэр) |
| [order_status_ux_proposal.md](./analysis/order_status_ux_proposal.md) | Захиалгын төлөв/буцаалтын UI/UX санал |
| [library_upgrade_plan.md](./analysis/library_upgrade_plan.md) | Library/package сайжруулалтын төлөвлөгөө |
| [improvement_idea.md](./analysis/improvement_idea.md) | Техникийн сайжруулалтын санаа |
| [ideas.md](./analysis/ideas.md) | Бизнесийн санаанууд |

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

### Үндсэн хавтас — функцийн гүнзгий баримт
| Файл | Тайлбар |
|---|---|
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Release-ийн үлдсэн зүйлс (зардал, env, бэлгийн хамгаалалт) |
| [qpay-testing.md](./qpay-testing.md) | QPay төлбөрийн тестийн гарын авлага — mock, harness, бодит төлбөр, callback, чеклист |
| [lucky-wheel.md](./lucky-wheel.md) | Азын хүрд — шагнал, магадлал, эдийн засгийн тооцоо |
| [requirement_final.md](./requirement_final.md) | Клиентийн эцсийн бизнес шаардлага |

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
