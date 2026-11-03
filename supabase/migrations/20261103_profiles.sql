begin;
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
  check (not (data ? 'bio') or (jsonb_typeof(data->'bio') = 'string' and length(data->>'bio') <= 1000)),
  check (not (data ? 'status') or (jsonb_typeof(data->'status') = 'string' and length(data->>'status') <= 100)),
  check (not (data ? 'photo') or (jsonb_typeof(data->'photo') = 'string' and length(data->>'photo') <= 180000 and (data->>'photo' = '' or data->>'photo' ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')))
);

create or replace function public.check_member_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Profile owner cannot be changed';
  end if;
  new.email = lower(auth.jwt()->>'email');
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists validate_member_profile on public.member_profiles;
create trigger validate_member_profile before insert or update on public.member_profiles
  for each row execute function public.check_member_profile();

alter table public.member_profiles enable row level security;
drop policy if exists "Pair reads profiles" on public.member_profiles;
create policy "Pair reads profiles" on public.member_profiles for select to authenticated
  using (public.is_member() and exists (select 1 from public.members where members.email = member_profiles.email));
drop policy if exists "Own profile insert" on public.member_profiles;
create policy "Own profile insert" on public.member_profiles for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "Own profile update" on public.member_profiles;
create policy "Own profile update" on public.member_profiles for update to authenticated using (public.is_member() and user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());
revoke all on public.member_profiles from anon, authenticated;
grant select, insert, update on public.member_profiles to authenticated;
commit;
