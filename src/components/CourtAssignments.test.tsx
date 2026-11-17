import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppData } from '../hooks/useAppData'
import CourtAssignments from './CourtAssignments'
import Courts from './Courts'
import Schedule from './Schedule'
import { fairness, playerStats } from '../lib/stats'
import { demoData } from '../lib/demo'
import { generateBalancedGames } from '../lib/generator'

vi.mock('../lib/supabase',()=>({supabase:null,isSupabaseConfigured:false}))
afterEach(cleanup)

describe('on-site court assignment',()=>{
  it('creates an unassigned match, assigns D, starts and finishes it, without changing teams',async()=>{
    const {result}=renderHook(()=>useAppData('관리자'))
    await act(async()=>{await result.current.admin('reset_scores',{},'1121')})
    await act(async()=>{await result.current.admin('create_match',{match_number:1,players:['p1','p2','p3','p4']},'1121')})
    const planned=result.current.data.matches[0]
    expect(planned.court_number).toBeNull()
    await expect(result.current.setStatus(planned.id,'playing')).rejects.toThrow('배정')
    await expect(result.current.assignCourt(planned,4,'wrong')).rejects.toThrow('관리자 PIN')
    await expect(result.current.assignCourt(planned,5,'1121')).rejects.toThrow('A~D')
    await act(async()=>{await result.current.assignCourt(planned,4,'1121')})
    expect(result.current.data.matches[0]).toMatchObject({court_number:4,status:'waiting',team_a:planned.team_a,team_b:planned.team_b})
    await act(async()=>{await result.current.setStatus(planned.id,'playing')})
    await expect(result.current.assignCourt(result.current.data.matches[0],null,'1121')).rejects.toThrow('대기 중')
    await act(async()=>{await result.current.setStatus(planned.id,'finished')})
    expect(playerStats(result.current.data.participants,result.current.data.matches)[0].completed).toBe(1)
  })
  it('can release and reassign a waiting match, rejects a stale assignment',async()=>{
    const {result}=renderHook(()=>useAppData('관리자'))
    const waiting=result.current.data.matches[3]
    await act(async()=>{await result.current.assignCourt(waiting,null,'1121')})
    expect(result.current.data.matches[3].court_number).toBeNull()
    await expect(result.current.assignCourt(waiting,4,'1121')).rejects.toThrow('변경')
    await act(async()=>{await result.current.assignCourt(result.current.data.matches[3],4,'1121')})
    expect(result.current.data.matches[3].court_number).toBe(4)
  })
  it('prevents overlapping players and courts from starting',async()=>{
    const {result}=renderHook(()=>useAppData('관리자'))
    const waiting=result.current.data.matches[3]
    await act(async()=>{await result.current.assignCourt(waiting,4,'1121')})
    await expect(result.current.setStatus(waiting.id,'playing')).rejects.toThrow('선수')
    await act(async()=>{await result.current.assignCourt(result.current.data.matches[3],1,'1121')})
    await expect(result.current.setStatus(waiting.id,'playing')).rejects.toThrow('해당 코트')
  })
  it('supports 17 people with four simultaneous matches, all generated without courts',async()=>{
    const {result}=renderHook(()=>useAppData('관리자'))
    await act(async()=>{
      await result.current.admin('reset_scores',{},'1121')
      for(let i=15;i<=17;i++)await result.current.admin('add_participant',{name:`참가자${i}`,gender:'male'},'1121')
    })
    const groups=generateBalancedGames(result.current.data.participants,4)
    await act(async()=>{await result.current.admin('generate_schedule',{rounds:groups.map(r=>({roundNumber:r.roundNumber,rests:r.rests.map(p=>p.id),matches:r.matches.map(m=>({matchNumber:m.matchNumber,teamA:m.teamA.map(p=>p.id),teamB:m.teamB.map(p=>p.id)}))}))},'1121')})
    expect(result.current.data.matches).toHaveLength(4)
    expect(result.current.data.matches.every(m=>m.court_number===null)).toBe(true)
    for(let i=0;i<4;i++){
      await act(async()=>{await result.current.assignCourt(result.current.data.matches[i],i+1,'1121')})
      await act(async()=>{await result.current.setStatus(result.current.data.matches[i].id,'playing')})
    }
    expect(result.current.data.matches.map(m=>m.court_number)).toEqual([1,2,3,4])
    expect(result.current.data.matches.every(m=>m.status==='playing')).toBe(true)
  })
  it('shows unassigned matches in the schedule and lets the operator assign one to D',async()=>{
    function Harness(){
      const api=useAppData('관리자')
      return <><button onClick={()=>void api.assignCourt(api.data.matches[3],null,'1121')}>배정 해제 테스트</button><CourtAssignments matches={api.data.matches} onAssign={(m,c)=>api.assignCourt(m,c,'1121')}/><Schedule data={api.data} stats={[]} fairness={fairness([])}/><Courts data={api.data} onScore={api.changeScore} onStatus={api.setStatus}/></>
    }
    render(<Harness/> )
    fireEvent.click(screen.getByRole('button',{name:'배정 해제 테스트'}))
    const choose=screen.getByRole('combobox',{name:'D코트에 배정할 매치'})
    await waitFor(()=>expect(choose).toBeEnabled())
    fireEvent.change(choose,{target:{value:'m4'}})
    fireEvent.click(screen.getByRole('region',{name:'D코트 배정'}).querySelector('button')!)
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('#4 경기를 D코트에 배정했습니다.'))
    fireEvent.click(screen.getByRole('tab',{name:/D/}))
    expect(screen.getByRole('tabpanel',{name:'D코트'})).toHaveTextContent('#4 경기')
    fireEvent.click(screen.getByRole('tabpanel',{name:'D코트'}).querySelector('button.primary')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('선수가 다른 코트')
  })
  it('shows assignment errors without claiming success',async()=>{
    render(<CourtAssignments matches={[{...demoData.matches[3],court_number:null}]} onAssign={vi.fn().mockRejectedValue(new Error('서버 연결 오류'))}/>)
    fireEvent.change(screen.getByRole('combobox',{name:'D코트에 배정할 매치'}),{target:{value:'m4'}})
    fireEvent.click(screen.getByRole('region',{name:'D코트 배정'}).querySelector('button')!)
    expect(await screen.findByRole('status')).toHaveTextContent('서버 연결 오류')
  })
})
