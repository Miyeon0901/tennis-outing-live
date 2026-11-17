import type { Match } from '../types'
import type { AwardAppearance } from '../lib/awardParticipation'

export default function MatchAwardStatus({match, appearances}:{match:Match;appearances:AwardAppearance[]|undefined}) {
  if (!appearances?.length) return null
  const players = [...match.team_a, ...match.team_b]
  return <span className="match-award-status" aria-label={`매치 #${match.match_number} 개인별 시상 반영`}>
    {appearances.map(a => <small key={a.participantId} className={a.included?'included':'excluded'}>
      {players.find(p=>p.id===a.participantId)?.name} · {a.number}번째 · 시상 {a.included?'반영':'제외'}
    </small>)}
  </span>
}
