-- Preserve existing assignments; new schedules may be created without a court.
alter table public.matches alter column court_number drop not null;
alter table public.matches drop constraint if exists matches_court_number_check;
alter table public.matches add constraint matches_court_number_check check (court_number between 1 and 4);
alter table public.matches drop constraint if exists matches_court_required_for_play;
alter table public.matches add constraint matches_court_required_for_play check (court_number is not null or status in ('waiting','cancelled'));

create or replace function public.assign_match_court(
  p_match_id uuid,p_court_number integer,p_expected_updated_at timestamptz,p_admin_token text,p_updated_by text
) returns public.matches
language plpgsql security definer set search_path=public as $$
declare previous public.matches; result public.matches;
begin
  if not coalesce(verify_admin_pin(p_admin_token),false) then raise exception '관리자 PIN이 올바르지 않습니다.'; end if;
  if p_court_number is not null and p_court_number not between 1 and 4 then raise exception 'A~D코트 중에서 선택해주세요.'; end if;
  if char_length(trim(coalesce(p_updated_by,''))) not between 1 and 30 then raise exception '수정자 이름이 필요합니다.'; end if;
  select * into previous from matches where id=p_match_id for update;
  if not found then raise exception '경기를 찾을 수 없습니다.'; end if;
  if previous.status<>'waiting' then raise exception '대기 중인 경기만 코트를 변경할 수 있습니다.'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception '경기가 변경되었습니다. 최신 대진을 확인한 뒤 다시 배정해주세요.'; end if;
  update matches set court_number=p_court_number,updated_at=now(),updated_by=trim(p_updated_by) where id=p_match_id returning * into result;
  return result;
end $$;
revoke all on function public.assign_match_court(uuid,integer,timestamptz,text,text) from public;
grant execute on function public.assign_match_court(uuid,integer,timestamptz,text,text) to anon,authenticated;

create or replace function public.set_match_status(p_match_id uuid,p_status text,p_updated_by text,p_admin_token text default null) returns public.matches
language plpgsql security definer set search_path=public as $$
declare previous public.matches; result public.matches; conflict_name text;
begin
  if p_status is null or p_status not in ('waiting','playing','finished','cancelled') then raise exception '잘못된 경기 상태입니다.'; end if;
  -- Serialize starts across courts so two simultaneous requests cannot share players.
  if p_status='playing' then perform pg_advisory_xact_lock(20261117,1); end if;
  select * into previous from matches where id=p_match_id for update;
  if not found then raise exception '경기를 찾을 수 없습니다.'; end if;
  if previous.status='finished' and p_status<>'finished' and not coalesce(verify_admin_pin(coalesce(p_admin_token,'')),false) then raise exception '종료 취소는 관리자만 가능합니다.'; end if;
  if p_status in ('playing','finished') and previous.court_number is null then raise exception '코트에 먼저 배정해주세요.'; end if;
  if p_status='playing' then
    if exists(select 1 from matches where court_number=previous.court_number and status='playing' and id<>p_match_id) then raise exception '해당 코트에서 다른 경기가 진행 중입니다.'; end if;
    select p.name into conflict_name from match_players target join match_players other on other.participant_id=target.participant_id
      join matches om on om.id=other.match_id join participants p on p.id=target.participant_id
      where target.match_id=p_match_id and om.status='playing' and om.id<>p_match_id limit 1;
    if conflict_name is not null then raise exception '% 참가자는 다른 코트에서 경기 중입니다.',conflict_name; end if;
  end if;
  update matches set status=p_status,started_at=case when p_status='playing' then coalesce(started_at,now()) else started_at end,
    finished_at=case when p_status='finished' then now() when p_status in ('waiting','playing') then null else finished_at end,
    updated_at=now(),updated_by=p_updated_by where id=p_match_id returning * into result;
  return result;
end $$;
notify pgrst, 'reload schema';
