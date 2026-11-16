import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MatchResultEditor from './MatchResultEditor'
import { demoData } from '../lib/demo'

afterEach(cleanup)
const match={...demoData.matches[0],status:'finished' as const,team_a_score:6,team_b_score:2}

it('keeps the original scores when cancelled and rejects empty inputs',()=>{
  const save=vi.fn(),close=vi.fn()
  render(<MatchResultEditor match={match} onSave={save} onClose={close}/>)
  expect(screen.getByRole('button',{name:'결과 저장'})).toBeDisabled()
  fireEvent.change(screen.getByRole('spinbutton',{name:'팀 A 최종 점수'}),{target:{value:''}})
  expect(screen.getByRole('button',{name:'결과 저장'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'취소'}))
  expect(close).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
})

it('keeps input and displays the server error when saving fails',async()=>{
  const save=vi.fn().mockRejectedValue(new Error('최신 결과를 확인해주세요.'))
  render(<MatchResultEditor match={match} onSave={save} onClose={vi.fn()}/>)
  fireEvent.change(screen.getByRole('spinbutton',{name:'팀 B 최종 점수'}),{target:{value:'7'}})
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'결과 저장'})))
  expect(save).toHaveBeenCalledWith(6,7)
  expect(screen.getByRole('alert')).toHaveTextContent('최신 결과를 확인해주세요.')
  expect(screen.getByRole('spinbutton',{name:'팀 B 최종 점수'})).toHaveValue(7)
})
