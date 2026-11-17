-- Persist the shared participation target / first-N award rule.
begin;

alter table public.settings add column if not exists award_match_limit integer not null default 5
  constraint settings_award_match_limit_check check (award_match_limit between 1 and 60);

create or replace function public.set_award_match_limit(p_match_limit integer,p_admin_token text)
returns public.settings
language plpgsql security definer set search_path=public as $$
declare result public.settings;
begin
  if not coalesce(verify_admin_pin(p_admin_token),false) then
    raise exception '관리자 PIN이 올바르지 않습니다.';
  end if;
  if p_match_limit is null or p_match_limit not between 1 and 60 then
    raise exception '1~60 사이의 정수를 입력해주세요.';
  end if;
  update settings set award_match_limit=p_match_limit,updated_at=now() where id=1 returning * into result;
  if not found then raise exception '행사 설정을 찾을 수 없습니다.'; end if;
  return result;
end $$;

revoke all on function public.set_award_match_limit(integer,text) from public;
grant execute on function public.set_award_match_limit(integer,text) to anon,authenticated;
notify pgrst, 'reload schema';

commit;
