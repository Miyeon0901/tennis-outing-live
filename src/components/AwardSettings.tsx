import { useEffect, useState } from 'react'
import type { PlayerStat } from '../types'
import { awardRule, isValidAwardMatchLimit, MAX_AWARD_MATCH_LIMIT } from '../lib/awardParticipation'

export default function AwardSettings({matchLimit,stats,onSave}:{matchLimit:number;stats:PlayerStat[];onSave:(value:number)=>Promise<void>}) {
  const [draft,setDraft]=useState(String(matchLimit))
  const [saving,setSaving]=useState(false), [message,setMessage]=useState('')
  useEffect(()=>{setDraft(String(matchLimit))},[matchLimit])
  const value=draft.trim()?Number(draft):NaN
  const valid=isValidAwardMatchLimit(value)
  const below=stats.filter(s=>s.completed<matchLimit)
  const save=async()=>{
    if(!valid||saving||value===matchLimit)return
    setSaving(true);setMessage('')
    try{await onSave(value);setMessage(`기준을 ${value}경기로 저장했습니다.`)}
    catch(e){setMessage(`설정 저장 실패: ${e instanceof Error?e.message:'잠시 후 다시 시도해주세요.'}`)}
    finally{setSaving(false)}
  }
  return <form className="award-settings" onSubmit={e=>{e.preventDefault();void save()}}>
    <label htmlFor="award-match-limit">최소 참여 목표 / 시상 반영 경기 수</label>
    <div className="inline-form"><input id="award-match-limit" type="number" min="1" max={MAX_AWARD_MATCH_LIMIT} step="1" value={draft} disabled={saving} onChange={e=>{setDraft(e.target.value);setMessage('')}}/>
      <button className="primary" disabled={saving||!valid||value===matchLimit}>{saving?'저장 중…':'기준 저장'}</button></div>
    <p>{awardRule(matchLimit)}</p>
    <p>전원 최소 {matchLimit}경기 참여가 목표입니다. 대진은 자동으로 변경되지 않습니다.</p>
    <p>현재 목표 미달 {below.length}명{below.length?`: ${below.map(s=>`${s.participant.name}(${s.completed}/${matchLimit})`).join(', ')}`:''}</p>
    <p>기준을 바꾸면 기존 경기의 순위와 시상 집계도 다시 계산됩니다.</p>
    {!valid&&<p role="alert">1~{MAX_AWARD_MATCH_LIMIT} 사이의 정수를 입력해주세요.</p>}
    {message&&<p role="status">{message}</p>}
  </form>
}
