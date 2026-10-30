-- Additive migration: existing records, files and authors are preserved.
begin;
alter table public.records add column if not exists updated_at timestamptz;
update public.records set updated_at = created_at where updated_at is null;
alter table public.records alter column updated_at set default now();
alter table public.records alter column updated_at set not null;

create or replace function public.check_record_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.author_id <> old.author_id or new.kind <> old.kind or new.created_at <> old.created_at or new.parent_id is distinct from old.parent_id) then
    raise exception 'Record identity cannot be changed';
  end if;
  if TG_OP = 'UPDATE' and new.data->>'space' is distinct from old.data->>'space' then
    raise exception 'Record space cannot be changed';
  end if;
  if new.kind = 'comment' and not exists (select 1 from public.records where id = new.parent_id and kind in ('post', 'diary')) then
    raise exception 'Comments require an accessible post or diary';
  end if;
  if new.kind = 'comment' and new.data->>'postId' is distinct from new.parent_id::text then
    raise exception 'Comment parent mismatch';
  end if;
  if new.kind = 'comment' and TG_OP = 'UPDATE' and new.data->>'replyTo' is distinct from old.data->>'replyTo' then
    raise exception 'Reply target cannot be changed';
  end if;
  if new.kind = 'comment' and TG_OP = 'INSERT' and new.data->>'replyTo' is not null and not exists (
    select 1 from public.records r where r.id::text = new.data->>'replyTo'
      and r.kind = 'comment' and r.parent_id = new.parent_id and r.data->>'replyTo' is null
  ) then
    raise exception 'Replies require a root comment on the same post';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop policy if exists "Pair updates board" on public.records;
create policy "Pair updates board" on public.records for update to authenticated
  using (public.is_member() and kind = 'post' and data->>'space' = 'board')
  with check (public.is_member() and kind = 'post' and data->>'space' = 'board');

-- Notifications are derived from shared posts; only each recipient's read markers
-- need storage. This also includes posts created before this migration.
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.records(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, record_id)
);
alter table public.notification_reads enable row level security;
drop policy if exists "Own notification reads" on public.notification_reads;
create policy "Own notification reads" on public.notification_reads for all to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid() and exists (
    select 1 from public.records where id = record_id and kind in ('post', 'diary')
  ));
revoke all on public.notification_reads from anon, authenticated;
grant select, insert, update on public.notification_reads to authenticated;

create table if not exists public.couple_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 10000),
  updated_at timestamptz not null default now()
);
alter table public.couple_settings enable row level security;
drop policy if exists "Pair manages settings" on public.couple_settings;
create policy "Pair manages settings" on public.couple_settings for all to authenticated
  using (public.is_member()) with check (public.is_member());
revoke all on public.couple_settings from anon, authenticated;
grant select, insert, update on public.couple_settings to authenticated;
commit;
