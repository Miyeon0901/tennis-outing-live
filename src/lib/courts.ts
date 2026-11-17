import type { Match } from '../types'

export const COURTS = [1,2,3,4] as const
export const courtLabel = (court: number) => ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' }[court] ?? String(court))
export const courtName = (court: number|null) => court===null?'코트 미배정':`${courtLabel(court)}코트`
export const orderedMatches = (matches: Match[]) => [...matches].sort((a,b)=>a.match_number-b.match_number)
export const currentMatch = (matches: Match[],court:number) => orderedMatches(matches).find(m=>m.court_number===court&&m.status==='playing')??orderedMatches(matches).find(m=>m.court_number===court&&m.status==='waiting')

export function assertCanStart(match:Match,matches:Match[]){
  if(match.court_number===null)throw new Error('코트에 배정한 뒤 경기를 시작해주세요.')
  const others=matches.filter(m=>m.id!==match.id&&m.status==='playing')
  if(others.some(m=>m.court_number===match.court_number))throw new Error('해당 코트에서 다른 경기가 진행 중입니다.')
  const ids=new Set([...match.team_a,...match.team_b].map(p=>p.id))
  if(others.some(m=>[...m.team_a,...m.team_b].some(p=>ids.has(p.id))))throw new Error('선수가 다른 코트에서 경기 중입니다.')
}
