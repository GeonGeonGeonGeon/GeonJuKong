-- Supabase SQL Editor에서 실행합니다. 맨 아래 두 이메일을 먼저 바꾸세요.
begin;
create table public.members (
  slot smallint primary key check (slot in (1, 2)),
  email text unique not null check (email = lower(email)),
  display_name text not null check (length(display_name) between 1 and 30)
);
alter table public.members enable row level security;

-- 사용자 메타데이터 대신 서명된 토큰의 이메일과 Google 제공자를 확인합니다.
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where email = lower(auth.jwt()->>'email')
      and auth.jwt()->'app_metadata'->>'provider' = 'google'
      and auth.uid() is not null
  );
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;
create policy "Members see the pair" on public.members for select to authenticated using (public.is_member());
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;

create table public.records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('diary','post','comment','message')),
  author_id uuid not null references auth.users(id),
  parent_id uuid references public.records(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object'),
  check (octet_length(data::text) <= 200000),
  check ((kind = 'comment' and parent_id is not null) or (kind <> 'comment' and parent_id is null)),
  check (case when kind = 'post' then length(trim(data->>'title')) between 1 and 120 and data ? 'title'
    else length(trim(data->>'text')) between 1 and 10000 and data ? 'text' end),
  check (case when kind in ('diary','post') then data ? 'date' and data->>'date' ~ '^\d{4}-\d{2}-\d{2}$' else true end)
);
create index records_created on public.records(created_at, id);
create index records_parent on public.records(parent_id);
create function public.check_record_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (new.id <> old.id or new.author_id <> old.author_id or new.kind <> old.kind or new.created_at <> old.created_at or new.parent_id is distinct from old.parent_id) then
    raise exception 'Record identity cannot be changed';
  end if;
  if new.kind = 'comment' and not exists (select 1 from public.records where id = new.parent_id and kind = 'post') then
    raise exception 'Comments require an accessible post';
  end if;
  if new.kind = 'comment' and new.data->>'postId' is distinct from new.parent_id::text then
    raise exception 'Comment parent mismatch';
  end if;
  return new;
end;
$$;
create trigger validate_record before insert or update on public.records for each row execute function public.check_record_update();
alter table public.records enable row level security;
create policy "Pair reads shared records" on public.records for select to authenticated using (public.is_member());
create policy "Members create own records" on public.records for insert to authenticated with check (public.is_member() and author_id = auth.uid());
create policy "Authors update own records" on public.records for update to authenticated using (public.is_member() and author_id = auth.uid()) with check (public.is_member() and author_id = auth.uid());
create policy "Authors delete own records" on public.records for delete to authenticated using (public.is_member() and author_id = auth.uid());
revoke all on public.records from anon, authenticated;
grant select, insert, update, delete on public.records to authenticated;

create table public.message_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);
alter table public.message_reads enable row level security;
create policy "Pair reads receipts" on public.message_reads for select to authenticated using (public.is_member());
create policy "Own receipt insert" on public.message_reads for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "Own receipt update" on public.message_reads for update to authenticated using (public.is_member() and user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());
revoke all on public.message_reads from anon, authenticated;
grant select, insert, update on public.message_reads to authenticated;

create table public.push_subscriptions (
  endpoint text primary key check (length(endpoint) < 2000),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object' and subscription ? 'endpoint' and subscription->>'endpoint' = endpoint),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "Own subscriptions" on public.push_subscriptions for all to authenticated using (public.is_member() and user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- 서비스 역할만 접근할 수 있는 푸시 중복 방지 기록입니다.
create table public.push_deliveries (
  record_id uuid primary key references public.records(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

-- 본인의 실제 Google 이메일 두 개로 반드시 바꾸세요. 세 번째 계정은 slot 제약으로 추가할 수 없습니다.
insert into public.members(slot,email,display_name) values
  (1,'zpsqptmxjs1@gmail.com','건'),
  (2,'tjswnrofl@gmail.com','선주');
commit;
