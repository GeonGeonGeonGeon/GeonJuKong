begin;
alter table public.member_profiles
  add constraint member_profiles_name_length
  check (not (data ? 'name') or (jsonb_typeof(data->'name') = 'string' and length(data->>'name') <= 30));
commit;
