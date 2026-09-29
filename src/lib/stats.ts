import type { AppData, Match, Participant, PlayerStat } from '../types'

export function playerStats(participants: Participant[], matches: Match[]): PlayerStat[] {
  return participants.filter(p => p.is_active).map(participant => {
    const mine = matches.filter(m => [...m.team_a, ...m.team_b].some(p => p.id === participant.id))
    const finished = mine.filter(m => m.status === 'finished')
    let wins = 0, losses = 0, draws = 0, scored = 0, conceded = 0
    finished.forEach(match => {
      const onA = match.team_a.some(p => p.id === participant.id)
      const mineScore = onA ? match.team_a_score : match.team_b_score
      const theirs = onA ? match.team_b_score : match.team_a_score
      scored += mineScore; conceded += theirs
      if (mineScore > theirs) wins += 1
      else if (mineScore < theirs) losses += 1
      else draws += 1
    })
    const finishedTimes = finished.map(m => m.finished_at).filter(Boolean).sort()
    const lastMatch = finishedTimes[finishedTimes.length - 1] ?? null
    const playing = mine.filter(m => m.status === 'playing').length
    const scheduled = mine.filter(m => m.status === 'waiting').length
    return {
      participant, scheduled, playing, completed: finished.length,
      totalParticipation: finished.length + playing, lastMatchAt: lastMatch,
      isResting: playing === 0, wins, losses, draws, scored, conceded,
      difference: scored - conceded, winRate: finished.length ? wins / finished.length * 100 : 0,
    }
  })
}

export function ranked(stats: PlayerStat[], key: 'scored' | 'wins' | 'losses' | 'difference' | 'winRate') {
  return [...stats].sort((a, b) => b[key] - a[key] || b.completed - a.completed || a.participant.name.localeCompare(b.participant.name, 'ko'))
}

export function competitionRank<T>(items: T[], value: (item: T) => number) {
  return items.map((item, index) => ({ item, rank: index && value(items[index - 1]) === value(item) ? null : index + 1 }))
    .map((row, i, rows) => ({ ...row, rank: row.rank ?? rows.slice(0, i).reverse().find(r => r.rank !== null)?.rank ?? 1 }))
}

export function fairness(stats: PlayerStat[]) {
  const counts = stats.map(s => s.completed)
  const min = counts.length ? Math.min(...counts) : 0
  const max = counts.length ? Math.max(...counts) : 0
  const average = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
  return { min, max, average, spread: max - min, lowest: stats.filter(s => s.completed === min) }
}

export function awardLeaders(data: AppData) {
  const stats = playerStats(data.participants, data.matches)
  const byScore = ranked(stats, 'scored'), byWins = ranked(stats, 'wins'), byLosses = ranked(stats, 'losses')
  const ties = (list: PlayerStat[], key: keyof PlayerStat) => list.filter(x => x[key] === list[0]?.[key])
  return { stats, byScore, byWins, byLosses, scoring: ties(byScore, 'scored'), winning: ties(byWins, 'wins'), resilience: ties(byLosses, 'losses') }
}
