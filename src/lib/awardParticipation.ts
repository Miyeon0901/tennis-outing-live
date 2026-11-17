import type { Match } from '../types'

export const DEFAULT_AWARD_MATCH_LIMIT = 5
export const MAX_AWARD_MATCH_LIMIT = 60

export function isValidAwardMatchLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_AWARD_MATCH_LIMIT
}

export function awardMatchLimit(value: unknown): number {
  return isValidAwardMatchLimit(value) ? value : DEFAULT_AWARD_MATCH_LIMIT
}

export function awardRule(value: unknown) {
  const limit = awardMatchLimit(value)
  return `시상은 개인별 먼저 출전한 ${limit}경기만 반영하며, ${limit + 1}번째부터는 승패·득점을 제외합니다.`
}

export interface AwardAppearance {
  participantId: string
  number: number
  included: boolean
}

function participationTime(match: Match) {
  // Legacy results can lack a start time. Never use updated_at: score corrections
  // must not change which first N appearances count toward awards.
  for (const value of [match.started_at, match.finished_at]) {
    if (value && Number.isFinite(Date.parse(value))) return Date.parse(value)
  }
  return Infinity
}

export function awardAppearances(matches: Match[], matchLimit = DEFAULT_AWARD_MATCH_LIMIT): Map<string, AwardAppearance[]> {
  const limit = awardMatchLimit(matchLimit)
  const started = matches.filter(m => m.status === 'playing' || m.status === 'finished')
    .sort((a, b) => {
      const at = participationTime(a), bt = participationTime(b)
      return (at === bt ? 0 : at < bt ? -1 : 1)
        || a.match_number - b.match_number || a.id.localeCompare(b.id)
    })
  const counts = new Map<string, number>()
  return new Map(started.map(match => [match.id, [...match.team_a, ...match.team_b].map(player => {
    const number = (counts.get(player.id) ?? 0) + 1
    counts.set(player.id, number)
    return { participantId: player.id, number, included: number <= limit }
  })]))
}
