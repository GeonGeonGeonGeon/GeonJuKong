begin;
create or replace function public.update_home_photo(selection jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare settings jsonb;
begin
  if not public.is_member() then raise exception 'Forbidden'; end if;
  if selection is not null and selection <> 'null'::jsonb then
    if jsonb_typeof(selection) <> 'array' then raise exception '올바른 사진을 선택해 주세요.'; end if;
    if exists (select 1 from jsonb_array_elements(selection) item
      where jsonb_typeof(item) <> 'object' or coalesce(item->>'recordId', '') = '' or coalesce(item->>'fileId', '') = '') then
      raise exception '올바른 사진을 선택해 주세요.';
    end if;
  end if;
  insert into public.couple_settings (id, data) values (1, jsonb_build_object('homePhoto', selection))
  on conflict (id) do update set data = jsonb_set(public.couple_settings.data, '{homePhoto}', coalesce(selection, 'null'::jsonb), true), updated_at = now()
  returning data into settings;
  return settings;
end;
$$;
revoke all on function public.update_home_photo(jsonb) from public;
grant execute on function public.update_home_photo(jsonb) to authenticated;
commit;
