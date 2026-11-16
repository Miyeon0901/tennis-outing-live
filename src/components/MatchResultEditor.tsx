import { useEffect, useRef, useState } from 'react'
import type { Match } from '../types'
import { courtLabel } from '../lib/courts'

export default function MatchResultEditor({match,onSave,onClose}:{match:Match;onSave:(a:number,b:number)=>Promise<void>;onClose:()=>void}){
  const [scoreA,setScoreA]=useState(String(match.team_a_score)),[scoreB,setScoreB]=useState(String(match.team_b_score))
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const busy=useRef(false),dialog=useRef<HTMLElement>(null),firstInput=useRef<HTMLInputElement>(null)
  const close=useRef(onClose);close.current=onClose
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    firstInput.current?.focus()
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy.current)close.current()
      if(event.key==='Tab'){
        const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')??[])
        const index=controls.indexOf(document.activeElement as HTMLElement)
        event.preventDefault();controls[(index+(event.shiftKey?-1:1)+controls.length)%controls.length]?.focus()
      }
    }
    document.addEventListener('keydown',keydown)
    return ()=>{document.removeEventListener('keydown',keydown);previous?.focus()}
  },[])
  const valid=[scoreA,scoreB].every(s=>/^\d+$/.test(s)&&Number.isSafeInteger(Number(s))&&Number(s)<=2147483647)
  const changed=Number(scoreA)!==match.team_a_score||Number(scoreB)!==match.team_b_score
  const save=async()=>{
    if(busy.current||!valid||!changed)return
    busy.current=true;setSaving(true);setError('')
    try{await onSave(Number(scoreA),Number(scoreB))}catch(e){setError(e instanceof Error?e.message:'경기 결과를 저장하지 못했습니다.')}
    finally{busy.current=false;setSaving(false)}
  }
  return <div className="modal-backdrop"><section ref={dialog} className="match-result-dialog" role="dialog" aria-modal="true" aria-labelledby="match-result-title">
    <p className="eyebrow">MATCH RESULT</p><h2 id="match-result-title">#{match.match_number} {courtLabel(match.court_number)}코트 결과 수정</h2>
    <p>기존 결과 {match.team_a_score} : {match.team_b_score} · 종료 상태는 유지됩니다.</p>
    <form onSubmit={event=>{event.preventDefault();void save()}}>
      <div className="match-result-inputs">
        <label><b>팀 A</b><span>{match.team_a.map(p=>p.name).join(' + ')}</span><input ref={firstInput} type="number" inputMode="numeric" min="0" max="2147483647" step="1" aria-label="팀 A 최종 점수" value={scoreA} disabled={saving} onChange={event=>setScoreA(event.target.value)}/></label>
        <strong>:</strong>
        <label><b>팀 B</b><span>{match.team_b.map(p=>p.name).join(' + ')}</span><input type="number" inputMode="numeric" min="0" max="2147483647" step="1" aria-label="팀 B 최종 점수" value={scoreB} disabled={saving} onChange={event=>setScoreB(event.target.value)}/></label>
      </div>
      <p>저장하면 승패·득점·순위가 수정된 점수로 다시 계산됩니다.</p>
      {error&&<p className="match-result-error" role="alert">{error}</p>}
      <div className="match-result-actions"><button type="button" className="ghost" disabled={saving} onClick={onClose}>취소</button><button className="primary" disabled={saving||!valid||!changed}>{saving?'저장 중…':'결과 저장'}</button></div>
    </form>
  </section></div>
}
