import { useEffect, useRef, useState } from 'react'
import type { LuckyDraw as Draw, Participant } from '../types'

export default function LuckyDraw({candidates,onDraw,onClose}:{candidates:Participant[];onDraw:()=>Promise<Draw>;onClose:()=>void}){
  const [phase,setPhase]=useState<'rolling'|'saving'|'result'|'error'>('rolling')
  const [index,setIndex]=useState(0)
  const [winner,setWinner]=useState<Participant|null>(null)
  const [error,setError]=useState('')
  const busy=useRef(false)
  const closeButton=useRef<HTMLButtonElement>(null)
  const resultButton=useRef<HTMLButtonElement>(null)
  const close=useRef(onClose)
  close.current=onClose
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    closeButton.current?.focus()
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy.current)close.current()
      if(event.key==='Tab'){
        const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.lucky-draw-dialog button:not(:disabled)'))
        const current=buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus()
      }
    }
    document.addEventListener('keydown',handleKey)
    return ()=>{document.removeEventListener('keydown',handleKey);previous?.focus()}
  },[])
  useEffect(()=>{if(phase==='result'||phase==='error')resultButton.current?.focus()},[phase])
  useEffect(()=>{
    if((phase!=='rolling'&&phase!=='saving')||candidates.length<2)return
    const timer=setInterval(()=>setIndex(current=>(current+1+Math.floor(Math.random()*(candidates.length-1)))%candidates.length),50)
    return ()=>clearInterval(timer)
  },[phase,candidates.length])
  const draw=async()=>{
    if(busy.current||phase!=='rolling'||!candidates.length)return
    busy.current=true;setPhase('saving')
    try{
      const result=await onDraw()
      const selected=candidates.find(p=>p.id===result.winner_id)
      if(!selected)throw new Error('추첨 결과가 저장됐습니다. 창을 닫고 이벤트 화면에서 당첨자를 확인해주세요.')
      setWinner(selected);setPhase('result')
    }catch(e){setError(e instanceof Error?e.message:'추첨 결과를 확인하지 못했습니다. 창을 닫고 이벤트 화면을 확인해주세요.');setPhase('error')}
    finally{busy.current=false}
  }
  return <div className="modal-backdrop lucky-draw-backdrop"><section className={`lucky-draw-dialog ${phase}`} role="dialog" aria-modal="true" aria-labelledby="lucky-draw-title">
    <button ref={closeButton} className="ghost lucky-draw-close" disabled={phase==='saving'} onClick={onClose} aria-label="추첨 화면 닫기">닫기</button>
    <p className="eyebrow">LUCKY DRAW</p><h2 id="lucky-draw-title">오늘의 럭키 플레이어</h2>
    <p className="lucky-draw-caption">{phase==='result'?'행운의 주인공을 소개합니다!':`추첨 대상 ${candidates.length}명 중 행운의 주인공은?`}</p>
    <div className="lucky-draw-stage">
      <span className="lucky-draw-ball" aria-hidden="true">{phase==='result'?'🎉':'🎾'}</span>
      <strong className="lucky-draw-name" aria-hidden={phase!=='result'}>{winner?.name??candidates[index%candidates.length]?.name??'참가자 없음'}</strong>
      <span className="lucky-draw-stage-label">{phase==='result'?'CONGRATULATIONS':'WHO’S THE LUCKY ONE?'}</span>
    </div>
    <p className="lucky-draw-status" role="status">{phase==='result'?`${winner?.name}님, 당첨을 축하합니다!`:phase==='saving'?'당첨자를 확정하고 있어요…':phase==='rolling'?'원하는 순간 추첨 버튼을 눌러주세요.':''}</p>
    {error&&<p className="lucky-draw-error" role="alert">{error}</p>}
    {phase==='rolling'||phase==='saving'?<button className="primary lucky-draw-stop" disabled={phase==='saving'||!candidates.length} onClick={()=>void draw()}>{phase==='saving'?'결과 확인 중…':'추첨'}</button>:<button ref={resultButton} className="primary lucky-draw-stop" onClick={onClose}>확인</button>}
  </section></div>
}
