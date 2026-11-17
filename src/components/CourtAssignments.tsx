import { useRef, useState } from 'react'
import type { Match } from '../types'
import { COURTS, courtName, orderedMatches } from '../lib/courts'

export default function CourtAssignments({matches,onAssign}:{matches:Match[];onAssign:(match:Match,court:number|null)=>Promise<void>}){
  const [selected,setSelected]=useState<Record<number,string>>({})
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const lock=useRef(false)
  const pending=orderedMatches(matches.filter(m=>m.court_number===null&&m.status==='waiting'))
  const assign=async(court:number)=>{
    const match=pending.find(m=>m.id===selected[court])
    if(!match||lock.current)return
    lock.current=true;setBusy(true);setMessage('')
    try{await onAssign(match,court);setSelected(prev=>({...prev,[court]:''}));setMessage(`#${match.match_number} 경기를 ${courtName(court)}에 배정했습니다.`)}
    catch(e){setMessage(e instanceof Error?e.message:'코트를 배정하지 못했습니다.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <article className="admin-panel court-assignment-panel"><header><h3>현장 코트 배정</h3></header>
    <p>코트 미배정 대진 {pending.length}개 · 원하는 코트의 대기열에 배정한 뒤 코트 탭에서 경기를 시작하세요.</p>
    {message&&<p role="status">{message}</p>}
    <div className="court-assignment-grid">{COURTS.map(court=>{
      const playing=matches.find(m=>m.court_number===court&&m.status==='playing')
      const waiting=orderedMatches(matches.filter(m=>m.court_number===court&&m.status==='waiting'))
      return <section key={court} aria-label={`${courtName(court)} 배정`}><h4>{courtName(court)}</h4>
        <p>{playing?`진행 #${playing.match_number}`:'진행 경기 없음'} · 대기 {waiting.length}개</p>
        {waiting.length>0&&<small>대기 순서 {waiting.map(m=>`#${m.match_number}`).join(' → ')}</small>}
        <select aria-label={`${courtName(court)}에 배정할 매치`} value={pending.some(m=>m.id===selected[court])?selected[court]:''} disabled={busy||!pending.length} onChange={e=>setSelected(prev=>({...prev,[court]:e.target.value}))}>
          <option value="">{pending.length?'매치를 선택하세요':'미배정 대진 없음'}</option>
          {pending.map(m=><option key={m.id} value={m.id}>#{m.match_number} {m.team_a.map(p=>p.name).join('+')} vs {m.team_b.map(p=>p.name).join('+')}</option>)}
        </select>
        <button className="primary full" disabled={busy||!pending.some(m=>m.id===selected[court])} onClick={()=>void assign(court)}>{busy?'배정 중…':'배정'}</button>
      </section>
    })}</div>
  </article>
}
