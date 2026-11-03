begin;

create table if not exists public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 120),
  notes text not null default '' check (length(notes) <= 2000),
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.check_bucket_item_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.author_id <> old.author_id or new.created_at <> old.created_at then
    raise exception 'Bucket item identity cannot be changed';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.check_bucket_item_update() from public;
drop trigger if exists validate_bucket_item on public.bucket_items;
create trigger validate_bucket_item before update on public.bucket_items
  for each row execute function public.check_bucket_item_update();

alter table public.bucket_items enable row level security;
drop policy if exists "Pair reads bucket list" on public.bucket_items;
create policy "Pair reads bucket list" on public.bucket_items for select to authenticated using (public.is_member());
drop policy if exists "Members add bucket goals" on public.bucket_items;
create policy "Members add bucket goals" on public.bucket_items for insert to authenticated with check (public.is_member() and author_id = auth.uid());
drop policy if exists "Pair updates bucket goals" on public.bucket_items;
create policy "Pair updates bucket goals" on public.bucket_items for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "Pair deletes bucket goals" on public.bucket_items;
create policy "Pair deletes bucket goals" on public.bucket_items for delete to authenticated using (public.is_member());
revoke all on public.bucket_items from anon, authenticated;
grant select, insert, update, delete on public.bucket_items to authenticated;

commit;
