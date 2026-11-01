begin;
create or replace function public.update_couple_date(field text, date_value text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  settings jsonb;
  birthdays jsonb;
  member_slot smallint;
  member_name text;
begin
  if not public.is_member() then raise exception 'Forbidden'; end if;
  if field is null or date_value is null or field not in ('startDate', 'birthday') or date_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or to_char(date_value::date, 'YYYY-MM-DD') <> date_value then
    raise exception '올바른 날짜를 선택해 주세요.';
  end if;
  select data into settings from public.couple_settings where id = 1 for update;
  if not found then raise exception '먼저 연애 시작일을 설정해 주세요.'; end if;
  if field = 'startDate' then
    settings := jsonb_set(settings, '{startDate}', to_jsonb(date_value), true);
  else
    select slot, display_name into member_slot, member_name from public.members where email = lower(auth.jwt()->>'email');
    birthdays := case when jsonb_typeof(settings->'birthdays') = 'array' then settings->'birthdays' else '[]'::jsonb end;
    birthdays := jsonb_build_array(
      case when member_slot = 1 then jsonb_build_object('id', '0', 'name', member_name, 'date', date_value) else coalesce(birthdays->0, '{}'::jsonb) end,
      case when member_slot = 2 then jsonb_build_object('id', '1', 'name', member_name, 'date', date_value) else coalesce(birthdays->1, '{}'::jsonb) end
    );
    settings := jsonb_set(settings, '{birthdays}', birthdays, true);
  end if;
  update public.couple_settings set data = settings, updated_at = now() where id = 1;
  return settings;
end;
$$;
revoke all on function public.update_couple_date(text, text) from public;
grant execute on function public.update_couple_date(text, text) to authenticated;
commit;
