-- schema.sql 실행 후 개발 확인용으로 실행하세요. 재실행해도 참가자는 중복되지 않습니다.
insert into public.participants(name)
select '참가자'||n from generate_series(1,14) n on conflict(name) do nothing;
update public.participants set gender=case when replace(name,'참가자','')::int%2=1 then 'male' else 'female' end where name ~ '^참가자([1-9]|1[0-4])$' and gender='unspecified';

do $$ declare ids uuid[]; r1 uuid; r2 uuid; i integer; mid uuid;
begin
 select array_agg(id order by replace(name,'참가자','')::int) into ids from participants where name ~ '^참가자([1-9]|1[0-4])$';
 if array_length(ids,1)<>14 or exists(select 1 from rounds) then return; end if;
 insert into rounds(round_number,label,status,rest_participant_ids) values(1,'ROUND 1','playing',array[ids[13],ids[14]]) returning id into r1;
 insert into rounds(round_number,label,status,rest_participant_ids) values(2,'ROUND 2','waiting',array[ids[11],ids[12]]) returning id into r2;
 for i in 1..6 loop
  insert into matches(match_number,court_number,round_id,order_index,status,started_at)
   values(i,((i-1)%3)+1,case when i<=3 then r1 else r2 end,case when i<=3 then 1 else 2 end,case when i<=3 then 'playing' else 'waiting' end,case when i<=3 then now() else null end) returning id into mid;
  if i=1 then insert into match_players values(mid,ids[1],'A',1),(mid,ids[2],'A',2),(mid,ids[3],'B',1),(mid,ids[4],'B',2);
  elsif i=2 then insert into match_players values(mid,ids[5],'A',1),(mid,ids[6],'A',2),(mid,ids[7],'B',1),(mid,ids[8],'B',2);
  elsif i=3 then insert into match_players values(mid,ids[9],'A',1),(mid,ids[10],'A',2),(mid,ids[11],'B',1),(mid,ids[12],'B',2);
  elsif i=4 then insert into match_players values(mid,ids[13],'A',1),(mid,ids[14],'A',2),(mid,ids[1],'B',1),(mid,ids[5],'B',2);
  elsif i=5 then insert into match_players values(mid,ids[2],'A',1),(mid,ids[6],'A',2),(mid,ids[3],'B',1),(mid,ids[7],'B',2);
  else insert into match_players values(mid,ids[4],'A',1),(mid,ids[8],'A',2),(mid,ids[9],'B',1),(mid,ids[10],'B',2); end if;
 end loop;
end $$;
