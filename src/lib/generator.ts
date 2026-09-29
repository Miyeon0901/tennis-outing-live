import type { Match, Participant, PlayerStat } from '../types'

type PairCounts = Map<string, number>
const pairKey = (a: string, b: string) => [a, b].sort().join(':')

export function recommendPlayers(participants: Participant[], stats: PlayerStat[], matches: Match[], count = 4) {
  const playing = new Set(matches.filter(m => m.status === 'playing').flatMap(m => [...m.team_a, ...m.team_b].map(p => p.id)))
  const history = new Map(stats.map(s => [s.participant.id, s]))
  return participants.filter(p => p.is_active && !playing.has(p.id)).sort((a, b) => {
    const sa = history.get(a.id)!, sb = history.get(b.id)!
    return sa.completed - sb.completed || (sa.lastMatchAt ?? '').localeCompare(sb.lastMatchAt ?? '') || a.name.localeCompare(b.name, 'ko')
  }).slice(0, count)
}

export function generateBalancedRounds(participants: Participant[], roundCount: number, startMatchNumber = 1) {
  const active = participants.filter(p => p.is_active)
  if (active.length < 4) return []
  const played = new Map(active.map(p => [p.id, 0]))
  const rested = new Map(active.map(p => [p.id, 0]))
  const partners: PairCounts = new Map(), opponents: PairCounts = new Map()
  const rounds: Array<{ roundNumber: number; matches: Array<{ court: number; teamA: Participant[]; teamB: Participant[]; matchNumber: number }>; rests: Participant[] }> = []
  let matchNumber = startMatchNumber

  for (let r = 1; r <= roundCount; r++) {
    const capacity = Math.min(12, Math.floor(active.length / 4) * 4)
    const ordered = [...active].sort((a, b) => (played.get(a.id)! - played.get(b.id)!) || (rested.get(b.id)! - rested.get(a.id)!) || Math.random() - .5)
    const selected = ordered.slice(0, capacity), rests = ordered.slice(capacity)
    rests.forEach(p => rested.set(p.id, rested.get(p.id)! + 1))
    const games = []
    const pool = [...selected]
    for (let c = 1; c <= Math.min(3, capacity / 4); c++) {
      const first = pool.shift()!
      const partnerIndex = pool.reduce((best, p, i) => (partners.get(pairKey(first.id, p.id)) ?? 0) < (partners.get(pairKey(first.id, pool[best]?.id ?? '')) ?? Infinity) ? i : best, 0)
      const partner = pool.splice(Math.max(0, partnerIndex), 1)[0]
      const candidates = pool.map((p, i) => ({ i, cost: (opponents.get(pairKey(first.id, p.id)) ?? 0) + (opponents.get(pairKey(partner.id, p.id)) ?? 0) })).sort((a,b) => a.cost-b.cost)
      const opp1 = pool.splice(candidates[0].i, 1)[0]
      const opp2Index = pool.reduce((best, p, i) => (partners.get(pairKey(opp1.id, p.id)) ?? 0) < (partners.get(pairKey(opp1.id, pool[best]?.id ?? '')) ?? Infinity) ? i : best, 0)
      const opp2 = pool.splice(Math.max(0, opp2Index), 1)[0]
      const teamA = [first, partner], teamB = [opp1, opp2]
      partners.set(pairKey(first.id, partner.id), (partners.get(pairKey(first.id, partner.id)) ?? 0) + 1)
      partners.set(pairKey(opp1.id, opp2.id), (partners.get(pairKey(opp1.id, opp2.id)) ?? 0) + 1)
      teamA.forEach(a => teamB.forEach(b => opponents.set(pairKey(a.id, b.id), (opponents.get(pairKey(a.id, b.id)) ?? 0) + 1)))
      ;[...teamA, ...teamB].forEach(p => played.set(p.id, played.get(p.id)! + 1))
      games.push({ court: c, teamA, teamB, matchNumber: matchNumber++ })
    }
    rounds.push({ roundNumber: r, matches: games, rests })
  }
  return rounds
}
