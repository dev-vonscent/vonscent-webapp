-- Үнэрийн нотын англи нэр: админ бөглөдөг толь.
--
-- Нотын зураг үүсгэхэд (gpt-image) монгол нот ойлгогдохгүй тул англи нэр
-- хэрэгтэй. Өмнө нь зөвхөн кодонд бичсэн хүснэгт (src/lib/ai/notes-en.ts,
-- анхны импортын нотууд) байсан. Тиймээс шинэ ус шинэ нот авчрахад тэр нот
-- чимээгүй хасагдаж, заримдаа «зурах нот алга» (NO_NOTES) гэж алдаа гардаг
-- байв.
--
-- Энэ хүснэгт кодын хүснэгтийг НӨХНӨ, мөн давхцвал дарж бичнэ. Админ
-- барааны засах хуудсан дээр англи нэргүй нотуудыг бөглөнө.
--   * en          — зургийн загварт өгөх англи нэр;
--   * is_abstract — зурагдахгүй хийсвэр аккорд (мускус, амбер, «модлог
--                   аялгуу»). Ийм нот зурагт орохгүй, дахиж асуугдахгүй.

create table if not exists note_translations (
  mn text primary key check (mn = btrim(mn) and mn <> ''),
  en text not null default '' check (en = btrim(en)),
  is_abstract boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null,
  -- Хийсвэр биш бол англи нэр заавал.
  check (is_abstract or en <> '')
);

comment on table note_translations is
  'Нотын англи нэр (зураг үүсгэхэд). src/lib/ai/notes-en.ts-ийн хүснэгтийг '
  'нөхөж, давхцвал дарж бичнэ.';

-- Зөвхөн admin API (service role) уншиж, бичнэ. Дэлгүүрт хэрэггүй.
alter table note_translations enable row level security;
