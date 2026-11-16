import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
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
    fireEvent.click(screen.getByRole('button',{name:'🎁 추첨 화면 열기'}))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('전체 참석자 14명 중 행운의 주인공은?')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'추첨'})).toBeEnabled()
    expect(screen.queryByText(/당첨을 축하합니다/)).not.toBeInTheDocument()
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
