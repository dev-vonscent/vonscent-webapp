-- «Миний мэдээлэл» бүрэн бөглөсний урамшуулал 500 → 1,000 V point (клиент,
-- task 8.4). 0163 нь 500-аар seed хийсэн; кодын `DEFAULT_PROFILE_POINTS`
-- аль хэдийн 1,000. Утга нь тохиргоонд хэвээр — админ дараа нь өөрчилж болно.
--
-- Expand only: зөвхөн `settings.loyalty`-ийн нэг түлхүүр. Туг `profile_info`
-- хаалттай үед `claim_profile_reward` юу ч олгохгүй хэвээр.

update settings
   set value = value || jsonb_build_object('profilePoints', 1000)
 where key = 'loyalty';
