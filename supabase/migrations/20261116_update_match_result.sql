-- Corrections record the whole score difference as one audit event per team.
alter table public.score_events alter column delta type integer;
alter table public.score_events drop constraint if exists score_events_delta_check;
alter table public.score_events add constraint score_events_delta_check check (delta<>0);

create or replace function public.update_match_result(
  p_match_id uuid, p_team_a_score integer, p_team_b_score integer,
  p_expected_updated_at timestamptz, p_admin_token text, p_updated_by text
) returns public.matches
language plpgsql security definer set search_path=public as $$
declare previous public.matches; result public.matches;
begin
  if not coalesce(verify_admin_pin(p_admin_token),false) then raise exception '관리자 PIN이 올바르지 않습니다.'; end if;
  if p_team_a_score is null or p_team_b_score is null or p_team_a_score<0 or p_team_b_score<0 then
    raise exception '점수는 0 이상의 정수여야 합니다.';
  end if;
  if char_length(trim(coalesce(p_updated_by,''))) not between 1 and 30 then raise exception '수정자 이름이 필요합니다.'; end if;
  select * into previous from matches where id=p_match_id for update;
  if not found then raise exception '이미 삭제되었거나 존재하지 않는 경기입니다.'; end if;
  if previous.status<>'finished' then raise exception '종료된 경기만 결과를 수정할 수 있습니다.'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then
    raise exception '다른 변경이 반영된 경기입니다. 창을 닫고 최신 결과를 확인한 뒤 다시 수정해주세요.';
  end if;
  update matches set team_a_score=p_team_a_score,team_b_score=p_team_b_score,
    updated_at=now(),updated_by=trim(p_updated_by) where id=p_match_id returning * into result;
  if p_team_a_score<>previous.team_a_score then
    insert into score_events(match_id,team,delta,created_by) values(p_match_id,'A',p_team_a_score-previous.team_a_score,trim(p_updated_by));
  end if;
  if p_team_b_score<>previous.team_b_score then
    insert into score_events(match_id,team,delta,created_by) values(p_match_id,'B',p_team_b_score-previous.team_b_score,trim(p_updated_by));
  end if;
  return result;
end $$;
revoke all on function public.update_match_result(uuid,integer,integer,timestamptz,text,text) from public;
grant execute on function public.update_match_result(uuid,integer,integer,timestamptz,text,text) to anon,authenticated;
notify pgrst, 'reload schema';
