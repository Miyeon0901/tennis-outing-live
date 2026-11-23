import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import Events from './Events'
import {demoData} from '../lib/demo'

afterEach(cleanup)
const data={...demoData,settings:{...demoData.settings,fashion_vote_status:'open' as const}}

it('submits two distinct candidates and prevents self-voting or a third selection',async()=>{
  const onVote=vi.fn().mockResolvedValue(undefined)
  render(<Events data={data} stats={[]} userName="참가자1" onVote={onVote}/>)
  expect(screen.getByRole('button',{name:'참가자1본인'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'참가자2'}))
  fireEvent.click(screen.getByRole('button',{name:'참가자3'}))
  fireEvent.click(screen.getByRole('button',{name:'참가자4'}))
  expect(screen.getByText('최대 2명까지 선택할 수 있습니다.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'2명 선택 저장하기'}))
  await waitFor(()=>expect(onVote).toHaveBeenCalledWith('p1',['p2','p3']))
  expect(await screen.findByText('투표 완료! 마감 후 결과가 공개됩니다.')).toBeInTheDocument()
})

it('shows a missing-server-function failure and does not claim a successful vote',async()=>{
  const message='Could not find the function public.set_fashion_votes(p_candidate_ids, p_voter_id) in the schema cache'
  render(<Events data={data} stats={[]} userName="참가자1" onVote={vi.fn().mockRejectedValue(new Error(message))}/>)
  fireEvent.click(screen.getByRole('button',{name:'참가자2'}))
  fireEvent.click(screen.getByRole('button',{name:'1명 선택 저장하기'}))
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.queryByText('투표 완료! 마감 후 결과가 공개됩니다.')).not.toBeInTheDocument()
})

it('does not offer vote submission after closing',()=>{
  render(<Events data={{...data,settings:{...data.settings,fashion_vote_status:'closed'}}} stats={[]} userName="참가자1" onVote={vi.fn()}/>)
  expect(screen.getByText('투표가 마감되었습니다.')).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/선택 저장하기/})).not.toBeInTheDocument()
})
