-- Upgrade the original one-vote schema without removing existing votes.
begin;
alter table public.fashion_votes drop constraint if exists fashion_votes_pkey;
alter table public.fashion_votes add constraint fashion_votes_pkey primary key(voter_id,candidate_id);

create or replace function public.set_fashion_votes(p_voter_id uuid,p_candidate_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$
declare vote_status text;
begin
  select fashion_vote_status into vote_status from settings where id=1 for share;
  if vote_status is distinct from 'open' then raise exception '현재 투표 중이 아닙니다.'; end if;
  -- Serialize replacements by the same voter, including requests from two devices.
  perform 1 from participants where id=p_voter_id and is_active for update;
  if not found then raise exception '활성 참가자만 투표할 수 있습니다.'; end if;
  if coalesce(cardinality(p_candidate_ids),0)>2 then raise exception '최대 2명까지 투표할 수 있습니다.'; end if;
  if (select count(distinct chosen.candidate_id) from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) as chosen(candidate_id))<>coalesce(cardinality(p_candidate_ids),0) then
    raise exception '같은 사람을 중복 선택할 수 없습니다.';
  end if;
  if p_voter_id=any(coalesce(p_candidate_ids,'{}'::uuid[])) then raise exception '자기 자신에게는 투표할 수 없습니다.'; end if;
  if exists(
    select 1 from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) as chosen(candidate_id)
    where not exists(select 1 from participants p where p.id=chosen.candidate_id and p.is_active)
  ) then raise exception '활성 참가자만 투표할 수 있습니다.'; end if;
  delete from fashion_votes where voter_id=p_voter_id;
  insert into fashion_votes(voter_id,candidate_id)
    select p_voter_id,chosen.candidate_id from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) as chosen(candidate_id);
end $$;
revoke all on function public.set_fashion_votes(uuid,uuid[]) from public;
grant execute on function public.set_fashion_votes(uuid,uuid[]) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
