-- Барааны эрчим (sillage) — КЛИЕНТИЙН бөглөсөн жагсаалтын дагуу.
--
-- 0078 нь багана үүсгээд утгыг нь концентрацаар ТААМАГЛАЖ дүүргэсэн
-- (EDT→light, EDP→medium, бусад→strong), «админ зөрүүтэйг нь гараар засна»
-- гэж үлдээсэн. Клиент «Vonscent Product Import Template.xlsx»-ийн «Тархац»
-- баганад бараа тус бүрийн эрчмийг гараар бөглөж өгсөн тул тэр таамаг одоо
-- хэрэггүй: 75 барааны 24 нь таамагтай зөрж байв (ж: Ombre nomade
-- medium→strong, Afternoon swim medium→light, Black opium medium→strong).
--
-- Тулгалт нь брэнд+нэрийг том/жижиг үсэг, цэг-хоосон зай, аксентаас салгаж
-- хийгдэнэ: Excel-д «Tom ford», «Terre D'Hermes» гэж бичигдсэн нь санд
-- «Tom Ford», «Terre D'Hermès» байж болно. `unaccent` extension шаардахгүйн
-- тулд `translate`-ээр латин аксентыг буулгав.
--
-- Жагсаалтад байхгүй бараа ХӨНДӨГДӨХГҮЙ — дараа нэмэгдсэн бараа 0078-ын
-- анхдагчаа хэвээр хадгална. Идемпотент: дахин ажиллуулахад ижил үр дүн.

create temp table _client_sillage (brand text, name text, sillage sillage_t)
  on commit drop;

insert into _client_sillage (brand, name, sillage) values
  ('versace', 'pourhomme', 'light'), -- Versace — Pour homme
  ('versace', 'eaufraiche', 'light'), -- Versace — Eau fraiche
  ('montblanc', 'explorer', 'medium'), -- Montblanc — Explorer
  ('versace', 'erosflame', 'medium'), -- Versace — Eros flame
  ('giorgioarmani', 'acquadigio', 'medium'), -- Giorgio Armani — Acqua di gio
  ('versace', 'eros', 'medium'), -- Versace — Eros
  ('valentino', 'borninroma', 'light'), -- Valentino — Born in roma
  ('montblanc', 'explorerextreme', 'medium'), -- Montblanc — Explorer extreme
  ('maisonmargiela', 'sailingday', 'light'), -- Maison margiela — Sailing day
  ('valentino', 'coralfantasy', 'medium'), -- Valentino — Coral fantasy
  ('hermes', 'terredhermeseaugivree', 'medium'), -- Hermes — Terre D'Hermes eau givree
  ('yvessaintlaurent', 'lanuitdelhomme', 'medium'), -- Yves Saint Laurent — La Nuit De L'Homme
  ('jeanpaulgaultier', 'lemaleelixir', 'strong'), -- Jean Paul Gaultier — Le male elixir
  ('jeanpaulgaultier', 'lemaleleparfum', 'medium'), -- Jean Paul Gaultier — Le male le parfum
  ('jeanpaulgaultier', 'lemaleinblue', 'medium'), -- Jean Paul Gaultier — Le male in blue
  ('bvlgari', 'glacialessence', 'medium'), -- Bvlgari — Glacial essence
  ('dior', 'sauvageedp', 'medium'), -- Dior — Sauvage edp
  ('bvlgari', 'maninblack', 'strong'), -- Bvlgari — Man in black
  ('azzaro', 'themostwanted', 'light'), -- Azzaro — The most wanted
  ('yvessaintlaurent', 'myslf', 'medium'), -- Yves Saint Laurent — MYSLF
  ('yvessaintlaurent', 'y', 'medium'), -- Yves Saint Laurent — Y
  ('viktorrolf', 'spicebombextreme', 'strong'), -- Viktor&Rolf — Spicebomb extreme
  ('gucci', 'guiltypourhomme', 'medium'), -- Gucci — Guilty pour homme
  ('prada', 'oceanlunarossa', 'light'), -- Prada — Ocean luna rossa
  ('gucci', 'guiltyelixirdeparfum', 'strong'), -- Gucci — Guilty elixir de parfum
  ('dior', 'hommeintense', 'strong'), -- Dior — Homme intense
  ('tomford', 'greyvetiver', 'medium'), -- Tom ford — Grey vetiver
  ('chanel', 'bleudechaneledp', 'medium'), -- Chanel — Bleu de chanel edp
  ('diptyque', 'eaudessens', 'light'), -- Diptyque — Eau des sens
  ('chanel', 'allurehommesport', 'medium'), -- Chanel — Allure homme sport
  ('tomford', 'ombreleather', 'strong'), -- Tom ford — Ombre leather
  ('chanel', 'platinumegoiste', 'medium'), -- Chanel — Platinum egoiste
  ('dior', 'sauvageelixir', 'strong'), -- Dior — Sauvage elixir
  ('creed', 'aventus', 'medium'), -- Creed — Aventus
  ('louisvuitton', 'imagination', 'medium'), -- Louis vuitton — Imagination
  ('louisvuitton', 'pacificchill', 'medium'), -- Louis vuitton — Pacific chill
  ('creed', 'silvermountainwater', 'medium'), -- Creed — Silver mountain water
  ('jeanpaulgaultier', 'lebeauleparfum', 'medium'), -- Jean Paul Gaultier — Le beau le parfum
  ('jeanpaulgaultier', 'ultramale', 'medium'), -- Jean Paul Gaultier — Ultra male
  ('lacoste', 'blancl1212', 'light'), -- Lacoste — Blanc l.12.12
  ('bvlgari', 'aqvapourhomme', 'light'), -- Bvlgari — Aqva pour homme
  ('emporioarmani', 'strongerwithyouintensely', 'strong'), -- Emporio armani — Stronger with you intensely
  ('yvessaintlaurent', 'tuxedo', 'strong'), -- Yves Saint Laurent — Tuxedo
  ('creed', 'absoluaventus', 'medium'), -- Creed — Absolu aventus
  ('maisonmargiela', 'bythefireplace', 'strong'), -- Maison margiela — By the fireplace
  ('valentino', 'borninromaintense', 'medium'), -- Valentino — Born in roma intense
  ('ralphlauren', 'poloest97edp', 'medium'), -- Ralph lauren — polo est.97 edp
  ('jeanpaulgaultier', 'lebeauparadisegarden', 'medium'), -- Jean Paul Gaultier — Le beau paradise garden
  ('creed', 'greenirishtweed', 'medium'), -- Creed — Green irish tweed
  ('louisvuitton', 'afternoonswim', 'light'), -- Louis vuitton — Afternoon swim
  ('maisonfranciskurkdjian', 'baccaratrouge540', 'strong'), -- Maison francis kurkdjian — Baccarat rouge 540
  -- Excel-д брэнд нь «Parfums de marley» гэж алдаатай, санд «Parfums de Marly».
  ('parfumsdemarly', 'layton', 'medium'), -- Parfums de Marly — Layton
  ('louisvuitton', 'ombrenomade', 'strong'), -- Louis vuitton — Ombre nomade
  ('rabanne', 'invictusvictoryelixir', 'strong'), -- Rabanne — Invictus victory elixir
  ('hermes', 'terredhermes', 'medium'), -- Hermes — Terre D'Hermes
  ('hugoboss', 'hugoman', 'light'), -- Hugo boss — Hugo man
  ('burberry', 'heroedp', 'medium'), -- Burberry — Hero edp
  ('tomford', 'oudwood', 'strong'), -- Tom ford — Oud wood
  ('lelabo', 'another13', 'light'), -- Le labo — Another 13
  ('yvessaintlaurent', 'monparis', 'medium'), -- Yves Saint Laurent — Mon paris
  ('parfumsdemarly', 'delina', 'medium'), -- Parfums de Marly — Delina
  ('yvessaintlaurent', 'libre', 'medium'), -- Yves Saint Laurent — Libre
  ('creed', 'aventusforher', 'medium'), -- Creed — Aventus for her
  ('gucci', 'floragorgeousgardenia', 'medium'), -- Gucci — Flora gorgeous gardenia
  ('burberry', 'herelixir', 'medium'), -- Burberry — Her elixir
  ('byredo', 'blanche', 'light'), -- Byredo — Blanche
  ('missdior', 'bloomingbouquet', 'light'), -- Miss dior — Blooming bouquet
  ('victoriassecret', 'bombshell', 'light'), -- Victoria's secret — Bombshell
  ('chanel', 'eaufraicheedp', 'medium'), -- Chanel — Eau fraiche edp
  ('chanel', 'eautendreedp', 'medium'), -- Chanel — Eau tendre edp
  ('chanel', 'mademoiselle', 'medium'), -- Chanel — Mademoiselle
  ('louisvuitton', 'spellonyou', 'medium'), -- Louis vuitton — Spell on you
  ('valentino', 'donnaborninroma', 'medium'), -- Valentino — Donna born in roma
  ('yvessaintlaurent', 'blackopium', 'strong'), -- Yves Saint Laurent — Black opium
  ('coach', 'floral', 'light') -- Coach — Floral
;

update products p
   set sillage = c.sillage
  from _client_sillage c
 where regexp_replace(translate(lower(p.brand), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') = c.brand
   and regexp_replace(translate(lower(p.name), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') = c.name
   and p.sillage is distinct from c.sillage;

-- Таараагүй мөрийг чимээгүй өнгөрөөхгүй: prod дээр нэр нь зөрсөн бараа
-- байвал энд харагдана. Migration-ыг зогсоох шалтгаан биш тул `notice`.
do $$
declare missing int;
begin
  select count(*) into missing
    from _client_sillage c
   where not exists (
     select 1 from products p
      where regexp_replace(translate(lower(p.brand), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') = c.brand
        and regexp_replace(translate(lower(p.name), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') = c.name);
  if missing > 0 then
    raise notice 'sillage: жагсаалтын % мөр санд таараагүй', missing;
  end if;
end $$;
