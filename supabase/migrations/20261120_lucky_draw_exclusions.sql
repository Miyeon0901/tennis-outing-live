create or replace function public.draw_lucky_with_exclusions(
  p_excluded_ids uuid[], p_admin_token text, p_updated_by text
) returns public.lucky_draws
language plpgsql security definer set search_path=public as $$
declare
  selected_winner uuid;
  result public.lucky_draws;
begin
  if not coalesce(public.verify_admin_pin(p_admin_token), false) then
    raise exception '관리자 PIN이 올바르지 않습니다.';
  end if;

  select p.id into selected_winner
  from public.participants p
  where p.is_active and not exists (
    select 1 from unnest(p_excluded_ids) as excluded(id) where excluded.id=p.id
  )
  order by random()
  limit 1;

  if selected_winner is null then
    raise exception '추첨 가능한 참가자가 없습니다.';
  end if;

  insert into public.lucky_draws(winner_id, pool_type, exclude_award_winners, drawn_by)
  values (selected_winner, 'all', coalesce(cardinality(p_excluded_ids),0)>0, p_updated_by)
  returning * into result;
  return result;
end $$;

revoke all on function public.draw_lucky_with_exclusions(uuid[],text,text) from public;
grant execute on function public.draw_lucky_with_exclusions(uuid[],text,text) to anon,authenticated;
notify pgrst, 'reload schema';
