import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LuckyDraw from './LuckyDraw'
import type { LuckyDraw as Draw, Participant } from '../types'

const candidates:Participant[]=[{id:'a',name:'김미연',gender:'female',is_active:true},{id:'b',name:'이윤섭',gender:'male',is_active:true}]
const result:Draw={id:'draw',winner_id:'b',pool_type:'all',exclude_award_winners:false,drawn_at:'2026-11-16T00:00:00Z',drawn_by:'관리자'}
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks()})

describe('lucky draw presentation',()=>{
  it('cycles every 50ms without drawing, then reveals the saved winner only once',async()=>{
    vi.useFakeTimers()
    let resolve!:(draw:Draw)=>void
    const onDraw=vi.fn(()=>new Promise<Draw>(done=>{resolve=done}))
    const {container}=render(<LuckyDraw candidates={candidates} onDraw={onDraw} onClose={vi.fn()}/>)
    expect(container.querySelector('.lucky-draw-name')).toHaveTextContent('김미연')
    act(()=>vi.advanceTimersByTime(49))
    expect(container.querySelector('.lucky-draw-name')).toHaveTextContent('김미연')
    act(()=>vi.advanceTimersByTime(1))
    expect(container.querySelector('.lucky-draw-name')).toHaveTextContent('이윤섭')
    expect(onDraw).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'추첨'}))
    fireEvent.click(screen.getByRole('button',{name:'결과 확인 중…'}))
    expect(onDraw).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button',{name:'추첨 화면 닫기'})).toBeDisabled()
    await act(async()=>resolve(result))
    expect(screen.getByRole('status')).toHaveTextContent('이윤섭님, 당첨을 축하합니다!')
    expect(screen.getByRole('button',{name:'확인'})).toHaveFocus()
    act(()=>vi.advanceTimersByTime(500))
    expect(container.querySelector('.lucky-draw-name')).toHaveTextContent('이윤섭')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('shows a failed request without displaying a fake winner or allowing a duplicate retry',async()=>{
    const onDraw=vi.fn().mockRejectedValue(new Error('서버 연결을 확인해주세요.'))
    render(<LuckyDraw candidates={candidates} onDraw={onDraw} onClose={vi.fn()}/>)
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'추첨'})))
    expect(screen.getByRole('alert')).toHaveTextContent('서버 연결을 확인해주세요.')
    expect(screen.queryByText(/당첨을 축하합니다/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'추첨'})).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'확인'})).toBeEnabled()
  })
  it('clears the animation when closed before drawing',()=>{
    vi.useFakeTimers()
    const clear=vi.spyOn(globalThis,'clearInterval')
    const onDraw=vi.fn(),onClose=vi.fn()
    const {unmount}=render(<LuckyDraw candidates={candidates} onDraw={onDraw} onClose={onClose}/>)
    fireEvent.keyDown(document,{key:'Escape'})
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    expect(clear).toHaveBeenCalled()
    expect(onDraw).not.toHaveBeenCalled()
  })
  it('supports a single candidate',async()=>{
    vi.useFakeTimers()
    const interval=vi.spyOn(globalThis,'setInterval')
    render(<LuckyDraw candidates={[candidates[1]]} onDraw={vi.fn().mockResolvedValue(result)} onClose={vi.fn()}/>)
    expect(interval).not.toHaveBeenCalled()
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'추첨'})))
    expect(screen.getByRole('status')).toHaveTextContent('이윤섭님, 당첨을 축하합니다!')
  })
})
