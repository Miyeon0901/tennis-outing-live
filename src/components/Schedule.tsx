import type { AppData, PlayerStat } from '../types'
import type { fairness } from '../lib/stats'
import { courtLabel } from '../lib/courts'

export default function Schedule({data,stats,fairness:f}:{data:AppData;stats:PlayerStat[];fairness:ReturnType<typeof fairness>}) {
  return <section className="page-section"><div className="section-title"><div><p className="eyebrow">MATCH PLAN</p><h2>코트별 경기 대기열</h2></div></div>
    {f.spread>=2&&<div className="warning">⚠ 경기 수 편차가 발생했습니다. {f.min}경기 참가자가 있습니다.</div>}
    <div className="fairness-panel"><div><small>최소</small><b>{f.min}</b></div><div><small>최대</small><b>{f.max}</b></div><div><small>평균</small><b>{f.average.toFixed(1)}</b></div><div><small>편차</small><b>{f.spread}</b></div></div>
    <div className="round-list">{[1,2,3].map(court=><article className="round-card" key={court}><header><div><span>COURT</span><b>{courtLabel(court)}</b></div><span className="tag">{data.matches.filter(m=>m.court_number===court&&m.status!=='cancelled').length}게임</span></header>
      <div className="round-matches">{data.matches.filter(m=>m.court_number===court&&m.status!=='cancelled').sort((a,b)=>a.match_number-b.match_number).map(m=><div key={m.id}><b>#{m.match_number}</b><span>{m.team_a.map(p=>p.name).join(' + ')}</span><em>VS</em><span>{m.team_b.map(p=>p.name).join(' + ')}</span></div>)}</div>
      {!data.matches.some(m=>m.court_number===court&&m.status!=='cancelled')&&<footer>예정된 경기가 없습니다.</footer>}
    </article>)}</div>
    <h3 className="subheading">실제 경기 참여 현황</h3><div className="participation-list">{[...stats].sort((a,b)=>a.completed-b.completed).map(s=><div key={s.participant.id}><span>{s.participant.name}</span><div className="bar"><i style={{width:`${Math.max(4,s.completed/Math.max(1,f.max)*100)}%`}}/></div><b>{s.completed}</b><small>완료 {s.completed} / 진행 {s.playing} / 예정 {s.scheduled}</small></div>)}</div>
  </section>
}
