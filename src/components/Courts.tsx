import { useState } from 'react'
import { Clock3, Minus, Plus } from 'lucide-react'
import type { AppData, Match, Team } from '../types'
import { courtLabel } from '../lib/courts'

export default function Courts({ data, onScore, onStatus }: { data: AppData; onScore: (id:string, team:Team, delta:number)=>Promise<void>; onStatus:(id:string,status:Match['status'])=>Promise<void> }) {
  const [busy, setBusy] = useState<string|null>(null)
  const [selectedCourt, setSelectedCourt] = useState(1)
  const activeFor = (court: number) => data.matches.find(m => m.court_number === court && m.status === 'playing') ?? data.matches.find(m => m.court_number === court && m.status === 'waiting')
  const score = async (match: Match, team: Team, delta: number) => { const key=`${match.id}${team}${delta}`; setBusy(key); try { await onScore(match.id,team,delta) } finally { setBusy(null) } }
  return <section className="page-section"><div className="section-title"><div><p className="eyebrow">COURTS</p><h2>현재 코트</h2></div><span className="status-pill"><i/> LIVE</span></div>
    <div className="court-tabs" role="tablist" aria-label="코트 선택">{[1,2,3].map(court=>{const match=activeFor(court);return <button key={court} role="tab" aria-selected={selectedCourt===court} className={selectedCourt===court?'active':''} onClick={()=>setSelectedCourt(court)}><span className={match?.status==='playing'?'court-live playing':'court-live'}/><b>{courtLabel(court)}</b>코트<small>{match?`GAME #${match.match_number}`:'대기 없음'}</small></button>})}</div>
    <div className="court-grid">{[1,2,3].map(court => { const match=activeFor(court); return <article className={`court-card ${match?.status ?? 'empty'} ${selectedCourt===court?'selected':''}`} key={court} role="tabpanel" aria-label={`${courtLabel(court)}코트`}>
      <header><div className="court-number"><b>{courtLabel(court)}</b><span>COURT</span></div>{match && <div className="match-meta"><small>NEXT GAME</small><strong>#{match.match_number} 경기</strong><span>{statusLabel(match.status)}</span></div>}</header>
      {!match ? <div className="empty-state">예정된 경기가 없습니다</div> : <>
        <div className="scoreboard">
          <TeamScore label="TEAM A" players={match.team_a.map(p=>p.name)} score={match.team_a_score} disabled={match.status!=='playing'} onChange={d=>score(match,'A',d)} busy={busy?.startsWith(`${match.id}A`)}/>
          <div className="score-divider"><span>:</span><small>POINTS</small></div>
          <TeamScore label="TEAM B" players={match.team_b.map(p=>p.name)} score={match.team_b_score} disabled={match.status!=='playing'} onChange={d=>score(match,'B',d)} busy={busy?.startsWith(`${match.id}B`)}/>
        </div>
        <footer><div className="updated"><Clock3 size={14}/>{match.updated_by ? `${time(match.updated_at)} · ${match.updated_by}` : '아직 기록 없음'}</div>
          {match.status==='waiting' && <button className="primary small" onClick={()=>onStatus(match.id,'playing')}>경기 시작</button>}
          {match.status==='playing' && <button className="finish small" onClick={()=>confirm('이 점수로 경기를 종료할까요?')&&onStatus(match.id,'finished')}>경기 종료</button>}
        </footer></>}
    </article>})}</div>
    <div className="next-link">다음 대진은 <b>대진 탭</b>에서 확인할 수 있어요.</div>
  </section>
}

function TeamScore({label,players,score,disabled,onChange,busy}:{label:string;players:string[];score:number;disabled:boolean;onChange:(d:number)=>void;busy?:boolean}) {
  return <div className="team-score"><small>{label}</small><div className="player-names">{players.join(' + ') || '선수 미정'}</div><strong>{score}</strong>
    <div className="score-buttons"><button aria-label={`${label} 1점 빼기`} disabled={disabled||score<=0||busy} onClick={()=>onChange(-1)}><Minus/></button><button aria-label={`${label} 1점 더하기`} className="plus" disabled={disabled||busy} onClick={()=>onChange(1)}><Plus/></button></div>
  </div>
}
const statusLabel=(s:Match['status'])=>({waiting:'대기',playing:'진행 중',finished:'종료',cancelled:'취소'}[s])
const time=(d:string)=>new Intl.DateTimeFormat('ko',{hour:'2-digit',minute:'2-digit'}).format(new Date(d))
