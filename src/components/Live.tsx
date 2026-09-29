import { Crown, Medal, Shield, Trophy } from 'lucide-react'
import type { AppData } from '../types'
import type { awardLeaders, fairness } from '../lib/stats'

export default function Live({data,awards,fairness:f}:{data:AppData;awards:ReturnType<typeof awardLeaders>;fairness:ReturnType<typeof fairness>}) {
  return <section className="page-section"><div className="hero-live"><p className="eyebrow">REAL-TIME LEADERBOARD</p><h2>LIVE AWARDS</h2><span><i/> 종료 경기 즉시 반영</span></div>
    <div className="award-grid">
      <Award icon={<Trophy/>} tone="lime" title="득점왕" leaders={(awards.byScore[0]?.scored??0)>0?awards.scoring.map(s=>s.participant.name):[]} value={`${awards.byScore[0]?.scored??0} POINTS`} note={`${awards.byScore[0]?.completed??0}경기 참여`}/>
      <Award icon={<Crown/>} tone="gold" title="다승왕" leaders={(awards.byWins[0]?.wins??0)>0?awards.winning.map(s=>s.participant.name):[]} value={`${awards.byWins[0]?.wins??0} WINS`} note={`승률 ${(awards.byWins[0]?.winRate??0).toFixed(0)}%`}/>
      <Award icon={<Shield/>} tone="coral" title={`${data.settings.resilience_award_name} 후보`} leaders={(awards.byLosses[0]?.losses??0)>0?awards.resilience.map(s=>s.participant.name):[]} value={`${awards.byLosses[0]?.losses??0} LOSSES`} note="끝까지 포기하지 않는 플레이어"/>
    </div>
    <article className="live-participation"><header><div><p className="eyebrow">PLAY BALANCE</p><h3>경기 참여 현황</h3></div><Medal/></header><div className="balance-number"><div><b>{f.min}</b><span>최소 경기</span></div><i/><div><b>{f.max}</b><span>최대 경기</span></div></div><p>현재 참여가 가장 적은 사람</p><div className="name-tags">{f.lowest.map(s=><span key={s.participant.id}>{s.participant.name}</span>)}</div></article>
    <div className="top5"><h3>득점 TOP 5</h3>{awards.byScore.slice(0,5).map((s,i)=><div key={s.participant.id}><b>{i+1}</b><span>{s.participant.name}</span><em>{s.scored}</em><small>점</small></div>)}</div>
  </section>
}
function Award({icon,tone,title,leaders,value,note}:{icon:React.ReactNode;tone:string;title:string;leaders:string[];value:string;note:string}){return <article className={`award-card ${tone}`}><div className="award-icon">{icon}</div><small>NOW LEADING</small><h3>{title}</h3><strong>{leaders.join(' · ')||'아직 없음'}</strong><b>{value}</b><p>{note}</p></article>}
