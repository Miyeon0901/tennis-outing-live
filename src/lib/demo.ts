import type { AppData, Match, Participant, Round } from '../types'

const participants: Participant[] = Array.from({ length: 14 }, (_, i) => ({ id: `p${i + 1}`, name: `참가자${i + 1}`, is_active: true }))
const rounds: Round[] = [1, 2].map(n => ({ id: `r${n}`, round_number: n, label: `ROUND ${n}`, status: n === 1 ? 'playing' : 'waiting', rest_participant_ids: n === 1 ? ['p13', 'p14'] : ['p11', 'p12'] }))
function match(id: number, court: number, round: number, players: number[]): Match {
  return { id: `m${id}`, match_number: id, court_number: court, round_id: `r${round}`, order_index: round,
    status: round === 1 ? 'playing' : 'waiting', team_a_score: 0, team_b_score: 0,
    started_at: round === 1 ? new Date().toISOString() : null, finished_at: null, updated_at: new Date().toISOString(), updated_by: null,
    team_a: players.slice(0, 2).map(n => participants[n - 1]), team_b: players.slice(2).map(n => participants[n - 1]) }
}
export const demoData: AppData = {
  participants, rounds,
  matches: [match(1,1,1,[1,2,3,4]), match(2,2,1,[5,6,7,8]), match(3,3,1,[9,10,11,12]), match(4,1,2,[13,14,1,5]), match(5,2,2,[2,6,3,7]), match(6,3,2,[4,8,9,10])],
  scoreEvents: [], fashionVotes: [], luckyDraws: [],
  settings: { current_round: 1, event_title: '11/21 테니스 미니게임', event_date: '2026-11-21', venue: '건국대학교 스포츠과학타운 테니스장', fashion_vote_status: 'not_started', reveal_fashion_during_vote: false, resilience_award_name: '불굴의 의지상', allow_duplicate_awards: true },
}
