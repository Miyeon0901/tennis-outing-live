-- Delete one match and its dependent player/score records (foreign-key cascades).
create or replace function public.delete_match(p_match_id uuid, p_admin_token text) returns void
language plpgsql security definer set search_path=public as $$
declare match_round_id uuid;
begin
  if not coalesce(verify_admin_pin(p_admin_token), false) then
    raise exception '관리자 PIN이 올바르지 않습니다.';
  end if;
  select round_id into match_round_id from matches where id=p_match_id for update;
  if not found then raise exception '이미 삭제되었거나 존재하지 않는 경기입니다.'; end if;
  delete from matches where id=p_match_id;
  delete from rounds r where r.id=match_round_id
    and not exists(select 1 from matches m where m.round_id=r.id);
end $$;
revoke all on function public.delete_match(uuid,text) from public;
grant execute on function public.delete_match(uuid,text) to anon,authenticated;
notify pgrst, 'reload schema';
