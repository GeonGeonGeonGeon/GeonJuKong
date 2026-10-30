begin;

-- Existing posts, comments and read markers remain unchanged.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check
  check (kind in ('diary', 'post', 'comment', 'message', 'event_notice'));

drop policy if exists "Own notification reads" on public.notification_reads;
create policy "Own notification reads" on public.notification_reads for all to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid() and exists (
    select 1 from public.records where id = record_id and kind in ('post', 'diary', 'comment', 'event_notice')
  ));

commit;
