import { useEffect, useMemo, useState } from 'react'
import { Gift, Shirt, Sparkles } from 'lucide-react'
import type { AppData, PlayerStat } from '../types'

export default function Events({data,stats,onVote,userName}:{data:AppData;stats:PlayerStat[];onVote:(voter:string,candidates:string[])=>Promise<void>;userName:string}){
  const me=data.participants.find(p=>p.name===userName); const mine=data.fashionVotes.filter(v=>v.voter_id===me?.id)
  const [choices,setChoices]=useState<string[]>(mine.map(v=>v.candidate_id)); const [message,setMessage]=useState('')
  useEffect(()=>setChoices(mine.map(v=>v.candidate_id)),[data.fashionVotes,me?.id])
  const counts=useMemo(()=>data.participants.map(p=>({p,count:data.fashionVotes.filter(v=>v.candidate_id===p.id).length})).sort((a,b)=>b.count-a.count),[data])
  const visible=data.settings.fashion_vote_status==='closed'||data.settings.reveal_fashion_during_vote
  const winner=counts[0]?.count ? counts.filter(x=>x.count===counts[0].count) : []
  const draw=data.luckyDraws[0], drawWinner=data.participants.find(p=>p.id===draw?.winner_id)
  const toggle=(candidateId:string)=>{setMessage('');setChoices(current=>current.includes(candidateId)?current.filter(id=>id!==candidateId):current.length<2?[...current,candidateId]:current);if(!choices.includes(candidateId)&&choices.length>=2)setMessage('최대 2명까지 선택할 수 있습니다.')}
  const submit=async()=>{if(!me)return setMessage('참가자 명단에 등록된 이름으로 입장해주세요.'); if(!choices.length)return; try{await onVote(me.id,choices);setMessage(data.settings.fashion_vote_status==='open'?'투표 완료! 마감 후 결과가 공개됩니다.':'투표가 마감되었습니다.')}catch(e){setMessage(e instanceof Error?e.message:'투표하지 못했습니다.') }}
  return <section className="page-section"><div className="section-title"><div><p className="eyebrow">SIDE EVENTS</p><h2>오늘의 이벤트</h2></div></div>
    <article className="event-card fashion"><div className="event-icon"><Shirt/></div><p className="eyebrow">BEST DRESSER</p><h3>오늘 가장 테니스룩이 멋진 사람은? 🎾✨</h3><p>최대 두 명을 선택하세요. 마감 전까지 선택을 바꿀 수 있어요.</p>
      {visible&&winner.length>0&&<div className="event-winner"><Sparkles/><span>현재 베스트 드레서</span><strong>{winner.map(x=>x.p.name).join(' · ')}</strong><b>{winner[0].count}표</b></div>}
      {data.settings.fashion_vote_status==='open'?<><div className="vote-grid">{data.participants.filter(p=>p.is_active).map(p=><button disabled={p.id===me?.id} className={choices.includes(p.id)?'selected':''} onClick={()=>toggle(p.id)} key={p.id}>{p.name}{p.id===me?.id&&<small>본인</small>}{visible&&<b>{counts.find(x=>x.p.id===p.id)?.count}표</b>}</button>)}</div><button className="primary full" disabled={!choices.length} onClick={submit}>{choices.length}명 선택 저장하기</button></>:<div className="closed-box">{data.settings.fashion_vote_status==='closed'?'투표가 마감되었습니다.':'아직 투표가 시작되지 않았습니다.'}</div>}
      {message&&<p className="success-message">{message}</p>}
    </article>
    <article className="event-card lucky"><div className="event-icon"><Gift/></div><p className="eyebrow">LUCKY DRAW</p><h3>오늘의 럭키 플레이어</h3>{drawWinner?<div className="draw-result"><span>🎉</span><strong>{drawWinner.name}</strong><p>{new Date(draw.drawn_at).toLocaleString('ko-KR')} 추첨</p></div>:<div className="closed-box">아직 추첨 전입니다. 모든 경기가 끝난 뒤 공개해요!</div>}</article>
    <article className="final-awards"><p className="eyebrow">FINAL CEREMONY PREVIEW</p><h3>🏆 11/21 TENNIS AWARDS</h3><p>득점왕 · 다승왕 · {data.settings.resilience_award_name} · 베스트 드레서 · 럭키드로우</p><small>관리 화면에서 행사 종료 후 최종 결과를 확인할 수 있습니다.</small></article>
  </section>
}
