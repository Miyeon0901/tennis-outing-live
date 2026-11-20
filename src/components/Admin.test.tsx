import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import Admin from './Admin'
import { useAppData } from '../hooks/useAppData'
import { playerStats } from '../lib/stats'

vi.mock('../lib/supabase',()=>({supabase:null,isSupabaseConfigured:false}))
afterEach(()=>{cleanup();vi.restoreAllMocks()})

async function openAdmin(failDelete=false){
  function Harness(){
    const api=useAppData('운영자')
    return <Admin api={failDelete?{...api,deleteMatch:async()=>{throw new Error('연결 오류')}}:api} stats={playerStats(api.data.participants,api.data.matches)}/>
  }
  render(<Harness/> )
  fireEvent.change(screen.getByPlaceholderText('PIN 입력'),{target:{value:'1121'}})
  fireEvent.click(screen.getByRole('button',{name:'관리자 모드 열기'}))
  await screen.findByRole('button',{name:'매치 #1 삭제'})
}

it('blocks starting a second match on an occupied court until the current match ends',async()=>{
  await openAdmin()
  const current=screen.getByRole('combobox',{name:'매치 #1 상태'})
  const next=screen.getByRole('combobox',{name:'매치 #4 상태'})
  const start=within(next).getByRole('option',{name:'진행중'})
  expect(current).toHaveValue('playing')
  expect(start).toBeDisabled()
  expect(next).toHaveAccessibleDescription('#1 경기 진행 중 · 종료 후 시작 가능')
  fireEvent.change(current,{target:{value:'finished'}})
  await waitFor(()=>expect(start).toBeEnabled())
  expect(next).not.toHaveAccessibleDescription()
  // Match #4 also shares a player with match #2 on B court.
  fireEvent.change(screen.getByRole('combobox',{name:'매치 #2 상태'}),{target:{value:'finished'}})
  fireEvent.change(next,{target:{value:'playing'}})
  await waitFor(()=>expect(next).toHaveValue('playing'))
})

describe('match deletion',()=>{
  it('keeps the match when confirmation is declined',async()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
    await openAdmin()
    fireEvent.click(screen.getByRole('button',{name:'매치 #1 삭제'}))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('되돌릴 수 없습니다'))
    expect(screen.getByRole('button',{name:'매치 #1 삭제'})).toBeInTheDocument()
  })
  it('removes only the confirmed match from the management list',async()=>{
    vi.spyOn(window,'confirm').mockReturnValue(true)
    await openAdmin()
    fireEvent.click(screen.getByRole('button',{name:'매치 #1 삭제'}))
    await waitFor(()=>expect(screen.queryByRole('button',{name:'매치 #1 삭제'})).not.toBeInTheDocument())
    expect(screen.getByRole('button',{name:'매치 #2 삭제'})).toBeInTheDocument()
    expect(screen.getByText('#1 경기를 삭제했습니다.')).toBeInTheDocument()
  })
  it('shows errors and keeps a match available for retry',async()=>{
    vi.spyOn(window,'confirm').mockReturnValue(true)
    await openAdmin(true)
    fireEvent.click(screen.getByRole('button',{name:'매치 #1 삭제'}))
    expect(await screen.findByText('경기 삭제 실패: 연결 오류')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'매치 #1 삭제'})).toBeEnabled()
  })
  it('cleans up score records and empty rounds, then recalculates participation',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    await act(async()=>{await result.current.changeScore('m1','A',1);await result.current.setStatus('m1','finished')})
    expect(playerStats(result.current.data.participants,result.current.data.matches)[0].completed).toBe(1)
    await act(async()=>{await result.current.deleteMatch('m1','1121')})
    expect(result.current.data.scoreEvents).toHaveLength(0)
    expect(result.current.data.rounds.some(r=>r.id==='r1')).toBe(true)
    expect(playerStats(result.current.data.participants,result.current.data.matches)[0].completed).toBe(0)
    await act(async()=>{await result.current.deleteMatch('m2','1121');await result.current.deleteMatch('m3','1121')})
    expect(result.current.data.rounds.map(r=>r.id)).toEqual(['r2'])
    expect(result.current.data.matches.map(m=>m.id)).toEqual(['m4','m5','m6'])
  })
  it('rejects deletion with an invalid administrator PIN',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    await expect(result.current.deleteMatch('m1','wrong')).rejects.toThrow('관리자 PIN')
    expect(result.current.data.matches).toHaveLength(6)
  })
})

describe('all-attendee lucky draw',()=>{
  it('opens the name roulette without requiring completed matches or saving a draw',async()=>{
    await openAdmin()
    fireEvent.click(screen.getByRole('button',{name:'🎁 추첨 대상 설정'}))
    fireEvent.click(screen.getByRole('button',{name:'추첨 화면 열기'}))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('추첨 대상 14명 중 행운의 주인공은?')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'추첨'})).toBeEnabled()
    expect(screen.queryByText(/당첨을 축하합니다/)).not.toBeInTheDocument()
  })
  it('excludes selected people from both the roulette and the saved draw',async()=>{
    await openAdmin()
    vi.spyOn(Math,'random').mockReturnValue(0)
    fireEvent.click(screen.getByRole('button',{name:'🎁 추첨 대상 설정'}))
    fireEvent.click(screen.getByRole('checkbox',{name:'참가자1'}))
    expect(screen.getByText('추첨 대상 13명 · 제외 1명')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'추첨 화면 열기'}))
    const dialog=within(screen.getByRole('dialog'))
    expect(dialog.getByText('추첨 대상 13명 중 행운의 주인공은?')).toBeInTheDocument()
    expect(dialog.queryByText('참가자1',{exact:true})).not.toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button',{name:'추첨'}))
    expect(await dialog.findByText('참가자2님, 당첨을 축하합니다!')).toBeInTheDocument()
  })
  it('draws from active attendees even with zero finished games and saves the winner',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    vi.spyOn(Math,'random').mockReturnValue(0)
    await act(async()=>{await result.current.admin('toggle_participant',{id:'p1'},'1121')})
    expect(result.current.data.matches.some(m=>m.status==='finished')).toBe(false)
    await act(async()=>{
      const draw=await result.current.drawLucky('1121')
      expect(draw.winner_id).toBe('p2')
      expect(draw.pool_type).toBe('all')
    })
    expect(result.current.data.luckyDraws).toHaveLength(1)
    expect(result.current.data.luckyDraws[0].winner_id).toBe('p2')
  })
})

describe('administrator result correction',()=>{
  it('edits a finished match directly from the management screen',async()=>{
    await openAdmin()
    const row=screen.getByRole('button',{name:'매치 #1 삭제'}).parentElement!
    fireEvent.change(within(row).getByRole('combobox'),{target:{value:'finished'}})
    fireEvent.click(await screen.findByRole('button',{name:'매치 #1 결과 수정'}))
    fireEvent.change(screen.getByRole('spinbutton',{name:'팀 A 최종 점수'}),{target:{value:'6'}})
    fireEvent.change(screen.getByRole('spinbutton',{name:'팀 B 최종 점수'}),{target:{value:'2'}})
    fireEvent.click(screen.getByRole('button',{name:'결과 저장'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('#1 경기 결과를 6:2로 수정했습니다.')).toBeInTheDocument()
    expect(within(row).getByRole('combobox')).toHaveValue('finished')
    expect(within(row).getByText('6:2')).toBeInTheDocument()
  })
  it('recalculates wins and scoring while retaining completion time and recording corrections',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    await act(async()=>{await result.current.setStatus('m1','finished')})
    const original=result.current.data.matches[0]
    await act(async()=>{await result.current.updateMatchResult(original,6,2,'1121')})
    const updated=result.current.data.matches[0]
    expect(updated.status).toBe('finished')
    expect(updated.finished_at).toBe(original.finished_at)
    expect(updated.updated_by).toBe('운영자')
    expect(result.current.data.scoreEvents.map(e=>[e.team,e.delta])).toEqual([['A',6],['B',2]])
    const stats=playerStats(result.current.data.participants,result.current.data.matches)
    expect(stats.find(s=>s.participant.id==='p1')).toMatchObject({completed:1,wins:1,scored:6,conceded:2})
    expect(stats.find(s=>s.participant.id==='p3')).toMatchObject({losses:1,scored:2,conceded:6})
    await act(async()=>{await result.current.updateMatchResult(updated,1,6,'1121')})
    expect(playerStats(result.current.data.participants,result.current.data.matches).find(s=>s.participant.id==='p3')?.wins).toBe(1)
    await expect(result.current.updateMatchResult(original,9,0,'1121')).rejects.toThrow('다른 변경')
  })
  it('rejects non-admin and non-finished corrections',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    const match=result.current.data.matches[0]
    await expect(result.current.updateMatchResult(match,6,0,'wrong')).rejects.toThrow('관리자 PIN')
    await expect(result.current.updateMatchResult(match,6,0,'1121')).rejects.toThrow('종료된 경기')
    expect(result.current.data.scoreEvents).toHaveLength(0)
  })
  it.each([-1,1.5,NaN,Infinity,2147483648])('rejects invalid score %s',async score=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    await expect(result.current.updateMatchResult(result.current.data.matches[0],score,0,'1121')).rejects.toThrow('0 이상의 정수')
  })
})
