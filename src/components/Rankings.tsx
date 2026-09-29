import { useState } from 'react'
import type { PlayerStat } from '../types'
import { ranked } from '../lib/stats'

export default function Rankings({stats}:{stats:PlayerStat[]}){
  const [sort,setSort]=useState<'scored'|'wins'|'winRate'|'difference'>('scored'); const rows=ranked(stats,sort)
  return <section className="page-section"><div className="section-title"><div><p className="eyebrow">ALL PLAYERS</p><h2>전체 순위</h2></div></div><div className="sort-tabs">{([['scored','득점'],['wins','다승'],['winRate','승률'],['difference','득실차']] as const).map(([k,l])=><button className={sort===k?'active':''} onClick={()=>setSort(k)} key={k}>{l}</button>)}</div>
    <div className="ranking-table"><div className="table-head"><span>순위 / 이름</span><span>경기</span><span>승-패-무</span><span>득점</span><span>실점</span><span>득실</span><span>승률</span></div>{rows.map((s,i)=><div className="table-row" key={s.participant.id}><span><b>{i+1}</b>{s.participant.name}</span><span>{s.completed}</span><span>{s.wins}-{s.losses}-{s.draws}</span><span className="accent">{s.scored}</span><span>{s.conceded}</span><span className={s.difference>=0?'positive':'negative'}>{s.difference>0?'+':''}{s.difference}</span><span>{s.winRate.toFixed(0)}%</span></div>)}</div>
  </section>
}
