-- Run the WHOLE file in SQL Editor, never an isolated selection.
-- Tests the deployed function and constraints; all test changes are rolled back.
begin;
do $$
declare voter uuid:=gen_random_uuid(); candidate_a uuid:=gen_random_uuid(); candidate_b uuid:=gen_random_uuid();
begin
  insert into public.participants(id,name) values
    (voter,'_qa_vote_'||left(voter::text,8)),
    (candidate_a,'_qa_vote_'||left(candidate_a::text,8)),
    (candidate_b,'_qa_vote_'||left(candidate_b::text,8));
  update public.settings set fashion_vote_status='open' where id=1;
  if not found then raise exception 'Missing event settings'; end if;
  perform public.set_fashion_votes(voter,array[candidate_a,candidate_b]);
  if (select count(*) from public.fashion_votes where voter_id=voter)<>2 then raise exception 'Two-vote save failed'; end if;
  perform public.set_fashion_votes(voter,array[candidate_b]);
  if (select count(*) from public.fashion_votes where voter_id=voter)<>1 or not exists(select 1 from public.fashion_votes where voter_id=voter and candidate_id=candidate_b) then raise exception 'Vote replacement failed'; end if;
  begin
    perform public.set_fashion_votes(voter,array[voter]);
    raise exception 'Self-vote was incorrectly accepted';
  exception when raise_exception then
    if sqlerrm not like '%자기 자신%' then raise; end if;
  end;
  update public.settings set fashion_vote_status='closed' where id=1;
  begin
    perform public.set_fashion_votes(voter,array[candidate_a]);
    raise exception 'Closed vote was incorrectly accepted';
  exception when raise_exception then
    if sqlerrm not like '%현재 투표 중이 아닙니다%' then raise; end if;
  end;
  if (select count(*) from public.fashion_votes where voter_id=voter)<>1 then raise exception 'Rejected request changed existing votes'; end if;
end $$;
rollback;
select 'PASS: two votes, replacement, self/closed rejection; rolled back' as rollback_test,
  (select count(*) from public.fashion_votes) as saved_votes;
