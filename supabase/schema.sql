-- 11/21 테니스 미니게임 - Supabase schema
-- Supabase SQL Editor에서 전체를 한 번 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(name) between 1 and 30),
  gender text not null default 'unspecified' check(gender in ('male','female','unspecified')),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.participants add column if not exists gender text not null default 'unspecified';
do $$ begin alter table public.participants add constraint participants_gender_check check(gender in ('male','female','unspecified')); exception when duplicate_object then null; end $$;
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(), round_number integer not null unique check (round_number > 0),
  label text not null, status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  rest_participant_ids uuid[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), match_number integer not null unique, court_number integer not null check (court_number between 1 and 3),
  round_id uuid references public.rounds(id) on delete set null, order_index integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
  team_a_score integer not null default 0 check (team_a_score >= 0), team_b_score integer not null default 0 check (team_b_score >= 0),
  started_at timestamptz, finished_at timestamptz, updated_at timestamptz not null default now(), updated_by text
);
create unique index if not exists one_playing_match_per_court on public.matches(court_number) where status='playing';
create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade, participant_id uuid not null references public.participants(id),
  team text not null check (team in ('A','B')), position smallint not null check (position in (1,2)),
  primary key (match_id, participant_id), unique(match_id,team,position)
);
create table if not exists public.score_events (
  id bigint generated always as identity primary key, match_id uuid not null references public.matches(id) on delete cascade,
  team text not null check (team in ('A','B')), delta smallint not null check (delta in (-1,1)),
  created_at timestamptz not null default now(), created_by text not null check (char_length(created_by) between 1 and 30)
);
create table if not exists public.settings (
  id smallint primary key default 1 check (id=1), current_round integer not null default 1,
  event_title text not null default '11/21 테니스 미니게임', event_date date not null default '2026-11-21',
  venue text not null default '건국대학교 스포츠과학타운 테니스장',
  fashion_vote_status text not null default 'not_started' check(fashion_vote_status in ('not_started','open','closed')),
  reveal_fashion_during_vote boolean not null default false, resilience_award_name text not null default '불굴의 의지상',
  allow_duplicate_awards boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.admin_secrets (id smallint primary key default 1 check(id=1), pin_hash text not null);
create table if not exists public.fashion_votes (
  voter_id uuid primary key references public.participants(id) on delete cascade,
  candidate_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(voter_id<>candidate_id)
);
create table if not exists public.lucky_draws (
  id uuid primary key default gen_random_uuid(), winner_id uuid not null references public.participants(id),
  pool_type text not null default 'played', exclude_award_winners boolean not null default false,
  drawn_at timestamptz not null default now(), drawn_by text not null
);

insert into public.settings(id) values(1) on conflict(id) do nothing;
insert into public.admin_secrets(id,pin_hash) values(1,extensions.crypt('1121',extensions.gen_salt('bf'))) on conflict(id) do nothing;

alter table public.participants enable row level security; alter table public.rounds enable row level security;
alter table public.matches enable row level security; alter table public.match_players enable row level security;
alter table public.score_events enable row level security; alter table public.settings enable row level security;
alter table public.admin_secrets enable row level security; alter table public.fashion_votes enable row level security;
alter table public.lucky_draws enable row level security;

do $$ declare t text; begin foreach t in array array['participants','rounds','matches','match_players','score_events','settings','fashion_votes','lucky_draws'] loop
  execute format('drop policy if exists public_read on public.%I',t);
  execute format('create policy public_read on public.%I for select to anon, authenticated using (true)',t);
end loop; end $$;
revoke insert,update,delete,truncate,references,trigger on all tables in schema public from anon,authenticated;
grant select on public.participants,public.rounds,public.matches,public.match_players,public.score_events,public.settings,public.fashion_votes,public.lucky_draws to anon,authenticated;

create or replace function public.verify_admin_pin(p_pin text) returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from admin_secrets where id=1 and pin_hash=extensions.crypt(p_pin,pin_hash));
$$;
revoke all on function public.verify_admin_pin(text) from public; grant execute on function public.verify_admin_pin(text) to anon,authenticated;

create or replace function public.set_admin_pin(p_old_pin text,p_new_pin text) returns boolean language plpgsql security definer set search_path=public as $$
begin if not verify_admin_pin(p_old_pin) then raise exception '관리자 PIN이 올바르지 않습니다.'; end if;
  if p_new_pin !~ '^[0-9]{4,12}$' then raise exception 'PIN은 숫자 4~12자리여야 합니다.'; end if;
  update admin_secrets set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf')) where id=1; return true;
end $$;

-- 한 행을 잠근 상태에서 현재 값에 delta를 더하므로 동시에 +1을 눌러도 입력이 유실되지 않습니다.
create or replace function public.change_score(p_match_id uuid,p_team text,p_delta integer,p_created_by text) returns public.matches
language plpgsql security definer set search_path=public as $$ declare result public.matches;
begin
  if p_team not in ('A','B') or p_delta not in (-1,1) then raise exception '잘못된 점수 변경입니다.'; end if;
  if char_length(trim(p_created_by)) not between 1 and 30 then raise exception '수정자 이름이 필요합니다.'; end if;
  if p_team='A' then
    update matches set team_a_score=team_a_score+p_delta,updated_at=now(),updated_by=trim(p_created_by)
    where id=p_match_id and status='playing' and team_a_score+p_delta>=0 returning * into result;
  else
    update matches set team_b_score=team_b_score+p_delta,updated_at=now(),updated_by=trim(p_created_by)
    where id=p_match_id and status='playing' and team_b_score+p_delta>=0 returning * into result;
  end if;
  if result.id is null then raise exception '진행 중인 경기만 변경할 수 있고 점수는 0보다 작을 수 없습니다.'; end if;
  insert into score_events(match_id,team,delta,created_by) values(p_match_id,p_team,p_delta,trim(p_created_by)); return result;
end $$;

create or replace function public.assert_no_concurrent_player() returns trigger language plpgsql set search_path=public as $$
begin if exists(select 1 from match_players mp join matches m on m.id=mp.match_id where mp.participant_id=new.participant_id and m.status='playing' and m.id<>new.id) then
 raise exception '한 참가자는 동시에 두 코트에서 경기할 수 없습니다.'; end if; return new; end $$;

create or replace function public.set_match_status(p_match_id uuid,p_status text,p_updated_by text,p_admin_token text default null) returns public.matches
language plpgsql security definer set search_path=public as $$ declare old_status text; result public.matches; conflict_name text;
begin
  if p_status not in ('waiting','playing','finished','cancelled') then raise exception '잘못된 경기 상태입니다.'; end if;
  select status into old_status from matches where id=p_match_id for update;
  if old_status='finished' and p_status<>'finished' and not verify_admin_pin(coalesce(p_admin_token,'')) then raise exception '종료 취소는 관리자만 가능합니다.'; end if;
  if p_status='playing' then
    select p.name into conflict_name from match_players target join match_players other on other.participant_id=target.participant_id
      join matches om on om.id=other.match_id join participants p on p.id=target.participant_id
      where target.match_id=p_match_id and om.status='playing' and om.id<>p_match_id limit 1;
    if conflict_name is not null then raise exception '% 참가자는 다른 코트에서 경기 중입니다.',conflict_name; end if;
  end if;
  update matches set status=p_status,started_at=case when p_status='playing' then coalesce(started_at,now()) else started_at end,
    finished_at=case when p_status='finished' then now() when p_status in ('waiting','playing') then null else finished_at end,
    updated_at=now(),updated_by=p_updated_by where id=p_match_id returning * into result; return result;
end $$;

create or replace function public.cast_fashion_vote(p_voter_id uuid,p_candidate_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if p_voter_id=p_candidate_id then raise exception '자기 자신에게는 투표할 수 없습니다.'; end if;
 if (select fashion_vote_status from settings where id=1)<>'open' then raise exception '현재 투표 중이 아닙니다.'; end if;
 if not exists(select 1 from participants where id=p_voter_id and is_active) or not exists(select 1 from participants where id=p_candidate_id and is_active) then raise exception '활성 참가자만 투표할 수 있습니다.'; end if;
 insert into fashion_votes(voter_id,candidate_id) values(p_voter_id,p_candidate_id)
 on conflict(voter_id) do update set candidate_id=excluded.candidate_id,updated_at=now();
end $$;

create or replace function public.admin_action(p_action text,p_payload jsonb,p_admin_token text,p_updated_by text) returns jsonb
language plpgsql security definer set search_path=public as $$ declare new_match_id uuid; rid uuid; item jsonb; game jsonb; draw_winner uuid;
begin if not verify_admin_pin(p_admin_token) then raise exception '관리자 PIN이 올바르지 않습니다.'; end if;
 case p_action
  when 'add_participant' then insert into participants(name,gender) values(trim(p_payload->>'name'),coalesce(p_payload->>'gender','unspecified'));
  when 'toggle_participant' then update participants set is_active=not is_active where id=(p_payload->>'id')::uuid;
  when 'update_participant' then update participants set name=trim(p_payload->>'name'),gender=coalesce(p_payload->>'gender',gender) where id=(p_payload->>'id')::uuid;
  when 'vote_status' then update settings set fashion_vote_status=p_payload->>'status',updated_at=now() where id=1;
  when 'setting' then
    if p_payload->>'key'='reveal_fashion_during_vote' then update settings set reveal_fashion_during_vote=(p_payload->>'value')::boolean where id=1;
    elsif p_payload->>'key'='allow_duplicate_awards' then update settings set allow_duplicate_awards=(p_payload->>'value')::boolean where id=1;
    elsif p_payload->>'key'='resilience_award_name' then update settings set resilience_award_name=left(p_payload->>'value',30) where id=1;
    else raise exception '변경할 수 없는 설정입니다.'; end if;
  when 'reset_scores' then update matches set team_a_score=0,team_b_score=0,status='waiting',started_at=null,finished_at=null,updated_at=now(),updated_by=p_updated_by; delete from score_events;
  when 'lucky_draw' then
    if coalesce(p_payload->>'pool_type','played')='all' then select id into draw_winner from participants where is_active order by gen_random_uuid() limit 1;
    else select participant_id into draw_winner from (select distinct mp.participant_id from match_players mp join matches m on m.id=mp.match_id join participants p on p.id=mp.participant_id where m.status='finished' and p.is_active) pool order by gen_random_uuid() limit 1; end if;
    if draw_winner is null then raise exception '추첨 가능한 참가자가 없습니다.'; end if;
    insert into lucky_draws(winner_id,pool_type,exclude_award_winners,drawn_by) values(draw_winner,coalesce(p_payload->>'pool_type','played'),coalesce((p_payload->>'exclude_award_winners')::boolean,false),p_updated_by);
  when 'create_match' then
    insert into matches(match_number,court_number,round_id,order_index) values((p_payload->>'match_number')::int,(p_payload->>'court_number')::int,nullif(p_payload->>'round_id','')::uuid,coalesce((p_payload->>'order_index')::int,0)) returning id into new_match_id;
    insert into match_players(match_id,participant_id,team,position) values
      (new_match_id,(p_payload->'players'->>0)::uuid,'A',1),(new_match_id,(p_payload->'players'->>1)::uuid,'A',2),
      (new_match_id,(p_payload->'players'->>2)::uuid,'B',1),(new_match_id,(p_payload->'players'->>3)::uuid,'B',2);
  when 'generate_schedule' then
    delete from matches where status='waiting';
    delete from rounds r where not exists(select 1 from matches m where m.round_id=r.id);
    for item in select * from jsonb_array_elements(p_payload->'rounds') loop
      insert into rounds(round_number,label,rest_participant_ids) values((item->>'roundNumber')::int,'ROUND '||(item->>'roundNumber'),array(select jsonb_array_elements_text(item->'rests'))::uuid[]) returning id into rid;
      for game in select * from jsonb_array_elements(item->'matches') loop
        insert into matches(match_number,court_number,round_id,order_index) values((game->>'matchNumber')::int,(game->>'court')::int,rid,(item->>'roundNumber')::int) returning id into new_match_id;
        insert into match_players(match_id,participant_id,team,position) values
         (new_match_id,(game->'teamA'->>0)::uuid,'A',1),(new_match_id,(game->'teamA'->>1)::uuid,'A',2),
         (new_match_id,(game->'teamB'->>0)::uuid,'B',1),(new_match_id,(game->'teamB'->>1)::uuid,'B',2);
      end loop;
    end loop;
  else raise exception '지원하지 않는 관리자 작업입니다.';
 end case; return jsonb_build_object('ok',true);
end $$;

grant execute on function public.change_score(uuid,text,integer,text) to anon,authenticated;
grant execute on function public.set_match_status(uuid,text,text,text) to anon,authenticated;
grant execute on function public.cast_fashion_vote(uuid,uuid) to anon,authenticated;
grant execute on function public.admin_action(text,jsonb,text,text) to anon,authenticated;
grant execute on function public.set_admin_pin(text,text) to anon,authenticated;

do $$ begin alter publication supabase_realtime add table public.participants,public.rounds,public.matches,public.match_players,public.score_events,public.settings,public.fashion_votes,public.lucky_draws;
exception when duplicate_object then null; end $$;
