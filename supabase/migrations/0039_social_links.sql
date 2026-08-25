-- Real social profiles for vonscent (footer / contact / home Instagram block).
-- Only fills instagram/facebook when they are still blank so an admin edit
-- made through the CMS is never clobbered.
update settings
set value = value
  || case when coalesce(value->>'instagram', '') = ''
       then jsonb_build_object('instagram', 'https://www.instagram.com/von_scent/')
       else '{}'::jsonb end
  || case when coalesce(value->>'facebook', '') = ''
       then jsonb_build_object('facebook', 'https://www.facebook.com/vonscent')
       else '{}'::jsonb end
where key = 'social';

insert into settings (key, value) values
  ('social', jsonb_build_object(
     'instagram', 'https://www.instagram.com/von_scent/',
     'facebook', 'https://www.facebook.com/vonscent',
     'phone', '',
     'email', 'hello@vonscent.mn'))
on conflict (key) do nothing;
