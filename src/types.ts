export type MatchStatus = 'waiting' | 'playing' | 'finished' | 'cancelled'
export type Team = 'A' | 'B'

export type Gender = 'male' | 'female' | 'unspecified'
export interface Participant { id: string; name: string; gender: Gender; is_active: boolean; created_at?: string }
export interface Round { id: string; round_number: number; label: string; status: 'waiting' | 'playing' | 'finished'; rest_participant_ids: string[] }
export interface Match {
  id: string; match_number: number; court_number: number; round_id: string | null; order_index: number
  status: MatchStatus; team_a_score: number; team_b_score: number; started_at: string | null
  finished_at: string | null; updated_at: string; updated_by: string | null
  team_a: Participant[]; team_b: Participant[]
}
export interface ScoreEvent { id: string; match_id: string; team: Team; delta: number; created_at: string; created_by: string }
export interface Settings {
  current_round: number; event_title: string; event_date: string; venue: string
  fashion_vote_status: 'not_started' | 'open' | 'closed'; reveal_fashion_during_vote: boolean
  resilience_award_name: string; allow_duplicate_awards: boolean
}
export interface FashionVote { voter_id: string; candidate_id: string; created_at?: string }
export interface LuckyDraw { id: string; winner_id: string; pool_type: string; exclude_award_winners: boolean; drawn_at: string; drawn_by: string }
export interface PlayerStat {
  participant: Participant; scheduled: number; playing: number; completed: number; totalParticipation: number
  lastMatchAt: string | null; isResting: boolean; wins: number; losses: number; draws: number
  scored: number; conceded: number; difference: number; winRate: number
}
export interface AppData {
  participants: Participant[]; rounds: Round[]; matches: Match[]; scoreEvents: ScoreEvent[]
  settings: Settings; fashionVotes: FashionVote[]; luckyDraws: LuckyDraw[]
}
