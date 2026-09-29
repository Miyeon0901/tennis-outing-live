import type { AppData, PlayerStat } from '../types'
import type { fairness } from '../lib/stats'

export default function Schedule({data,stats,fairness:f}:{data:AppData;stats:PlayerStat[];fairness:ReturnType<typeof fairness>}) {
  return <section className="page-section"><div className="section-title"><div><p className="eyebrow">MATCH PLAN</p><h2>라운드 & 대진</h2></div></div>
    {f.spread>=2&&<div className="warning">⚠ 경기 수 편차가 발생했습니다. {f.min}경기 참가자가 있습니다.</div>}
    <div className="fairness-panel"><div><small>최소</small><b>{f.min}</b></div><div><small>최대</small><b>{f.max}</b></div><div><small>평균</small><b>{f.average.toFixed(1)}</b></div><div><small>편차</small><b>{f.spread}</b></div></div>
    <div className="round-list">{data.rounds.map(round=><article className="round-card" key={round.id}><header><div><span>ROUND</span><b>{round.round_number}</b></div><span className={`tag ${round.status}`}>{round.status==='playing'?'진행 중':round.status==='finished'?'종료':'예정'}</span></header>
      <div className="round-matches">{data.matches.filter(m=>m.round_id===round.id).sort((a,b)=>a.court_number-b.court_number).map(m=><div key={m.id}><b>{m.court_number}코트</b><span>{m.team_a.map(p=>p.name).join(' + ')}</span><em>VS</em><span>{m.team_b.map(p=>p.name).join(' + ')}</span></div>)}</div>
      <footer><b>REST</b> {round.rest_participant_ids.map(id=>data.participants.find(p=>p.id===id)?.name).filter(Boolean).join(' · ')||'없음'}</footer>
    </article>)}</div>
    <h3 className="subheading">실제 경기 참여 현황</h3><div className="participation-list">{[...stats].sort((a,b)=>a.completed-b.completed).map(s=><div key={s.participant.id}><span>{s.participant.name}</span><div className="bar"><i style={{width:`${Math.max(4,s.completed/Math.max(1,f.max)*100)}%`}}/></div><b>{s.completed}</b><small>완료 {s.completed} / 진행 {s.playing} / 예정 {s.scheduled}</small></div>)}</div>
  </section>
}
