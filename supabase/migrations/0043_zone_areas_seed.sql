-- Хүргэлтийн бүсүүдийг дүүргээр нь бөглөнө (requirement_final.md §5:
-- бүсчилсэн үнэ + хүргэлт хийхгүй бүс — Налайх г.м.).
--
-- adm2 p-codes (src/lib/geo/mn-locations.json):
--   А бүс: Баянгол MN1107, Сүхбаатар MN1119, Чингэлтэй MN1125, Хан-Уул MN1122
--   Б бүс: Баянзүрх MN1110, Сонгинохайрхан MN1116
--   Хүргэлтгүй (X): Налайх MN1113, Багануур MN1101, Багахангай MN1104
-- В бүс (захын хороолол) хороо түвшний тохиргоо тул хоосон үлдээнэ — админ
-- Тохиргоо хуудсаар тодорхой хороодыг Б бүсээс өргөж/буулгаж болно. Шарга
-- морьт, 22 товчоо зэрэг зуслангийн цэгүүд мөн хороогоор X бүсэд нэмэгдэнэ.
-- Аль хэдийн areas бөглөсөн бүсийг дарж бичихгүй.

update settings
set value = jsonb_set(
  value,
  '{zones}',
  (
    select jsonb_agg(
      case
        when coalesce(jsonb_array_length(z->'areas'), 0) > 0 then z
        when z->>'code' = 'A' then
          z || jsonb_build_object('areas',
            jsonb_build_array('MN1107', 'MN1119', 'MN1125', 'MN1122'))
        when z->>'code' = 'B' then
          z || jsonb_build_object('areas',
            jsonb_build_array('MN1110', 'MN1116'))
        when z->>'code' = 'X' then
          z || jsonb_build_object('areas',
            jsonb_build_array('MN1113', 'MN1101', 'MN1104'))
        else z
      end
      order by ord
    )
    from jsonb_array_elements(value->'zones') with ordinality as t(z, ord)
  )
)
where key = 'shipping'
  and jsonb_typeof(value->'zones') = 'array';
