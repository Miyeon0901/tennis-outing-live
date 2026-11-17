import { useState } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AwardSettings from './AwardSettings'
import Admin from './Admin'
import { useAppData } from '../hooks/useAppData'
import { awardLeaders } from '../lib/stats'
import { awardFixture } from '../test/awardFixture'

vi.mock('../lib/supabase',()=>({supabase:null,isSupabaseConfigured:false}))
afterEach(cleanup)

describe('shared participation and award target',()=>{
  it('saves a new value through the admin screen and retains it after relocking',async()=>{
    function Harness(){
      const api=useAppData('운영자')
      return <Admin api={api} stats={awardLeaders(api.data).stats}/>
    }
    render(<Harness/> )
    const unlock=async()=>{
      fireEvent.change(screen.getByPlaceholderText('PIN 입력'),{target:{value:'1121'}})
      fireEvent.click(screen.getByRole('button',{name:'관리자 모드 열기'}))
      await screen.findByLabelText('최소 참여 목표 / 시상 반영 경기 수')
    }
    await unlock()
    fireEvent.change(screen.getByLabelText('최소 참여 목표 / 시상 반영 경기 수'),{target:{value:'4'}})
    fireEvent.click(screen.getByRole('button',{name:'기준 저장'}))
    expect(await screen.findByText('기준을 4경기로 저장했습니다.')).toBeInTheDocument()
    expect(screen.getAllByText(/먼저 출전한 4경기만 반영/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button',{name:'잠금'}))
    await unlock()
    expect(screen.getByLabelText('최소 참여 목표 / 시상 반영 경기 수')).toHaveValue(4)
  })

  it('shows participation deficits against the saved target, not an unsaved draft',async()=>{
    const stats=awardLeaders(awardFixture()).stats.filter(s=>s.participant.id==='p1')
    function Harness(){
      const [value,setValue]=useState(5)
      return <AwardSettings matchLimit={value} stats={stats} onSave={async n=>setValue(n)}/>
    }
    render(<Harness/> )
    expect(screen.getByText('현재 목표 미달 0명')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('최소 참여 목표 / 시상 반영 경기 수'),{target:{value:'7'}})
    expect(screen.getByText('현재 목표 미달 0명')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'기준 저장'}))
    expect(await screen.findByText('현재 목표 미달 1명: 참가자1(6/7)')).toBeInTheDocument()
  })

  it('keeps the saved rule when saving fails and allows a retry',async()=>{
    const save=vi.fn().mockRejectedValue(new Error('서버 연결 오류'))
    render(<AwardSettings matchLimit={5} stats={[]} onSave={save}/>)
    fireEvent.change(screen.getByLabelText('최소 참여 목표 / 시상 반영 경기 수'),{target:{value:'6'}})
    fireEvent.click(screen.getByRole('button',{name:'기준 저장'}))
    expect(await screen.findByRole('status')).toHaveTextContent('설정 저장 실패: 서버 연결 오류')
    expect(screen.getByText(/먼저 출전한 5경기만 반영/)).toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('button',{name:'기준 저장'})).toBeEnabled())
  })

  it('rejects invalid counts and unauthenticated changes at the data layer',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    for(const value of [0,-1,1.5,61,NaN,Infinity]){
      await expect(result.current.setAwardMatchLimit(value,'1121')).rejects.toThrow('정수')
    }
    await expect(result.current.setAwardMatchLimit(4,'wrong')).rejects.toThrow('관리자 PIN')
    expect(result.current.data.settings.award_match_limit).toBe(5)
    await act(async()=>{await result.current.setAwardMatchLimit(4,'1121')})
    expect(result.current.data.settings.award_match_limit).toBe(4)
    await act(async()=>{await result.current.admin('setting',{key:'award_match_limit',value:6},'1121')})
    expect(result.current.data.settings.award_match_limit).toBe(6)
  })
})
