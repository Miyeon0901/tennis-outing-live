import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { awardFixture } from '../test/awardFixture'
import { awardAppearances } from '../lib/awardParticipation'
import { awardLeaders, fairness, playerStats } from '../lib/stats'
import MatchAwardStatus from './MatchAwardStatus'
import Rankings from './Rankings'
import Schedule from './Schedule'
import Live from './Live'

afterEach(cleanup)

describe('award participation displays',()=>{
  it('shows different eligibility for players in the same match',()=>{
    const data=awardFixture(), match=data.matches[5]
    render(<MatchAwardStatus match={match} appearances={awardAppearances(data.matches).get(match.id)}/>)
    expect(screen.getByText('참가자1 · 6번째 · 시상 제외')).toBeInTheDocument()
    expect(screen.getByText('참가자3 · 5번째 · 시상 반영')).toBeInTheDocument()
  })

  it('shows award counts alongside actual participation and capped statistics in rankings',()=>{
    const data=awardFixture()
    render(<Rankings stats={playerStats(data.participants,data.matches)}/>)
    const row=screen.getByText('참가자1',{selector:'.table-row > span'}).closest<HTMLElement>('.table-row')!
    expect(within(row).getByLabelText('시상 반영 5경기 / 실제 완료 6경기')).toHaveTextContent('5 / 6')
    expect(within(row).getByText('2-2-1')).toBeInTheDocument()
    expect(within(row).getByText('40%')).toBeInTheDocument()
  })

  it('retains six actual mixed games in the schedule while showing five award results',()=>{
    const data=awardFixture(), stats=playerStats(data.participants,data.matches)
    render(<Schedule data={data} stats={stats} fairness={fairness(stats)}/>)
    const row=screen.getByText('참가자1',{selector:'.participation-list > div > span'}).parentElement!
    expect(within(row).getByLabelText('총 완료 6경기')).toBeInTheDocument()
    expect(within(row).getByText('반영 5 / 제외 1')).toBeInTheDocument()
    expect(within(row).getByText('완료 6 / 진행 0 / 예정 0')).toBeInTheDocument()
  })

  it('explains the same five-game rule on the live awards screen',()=>{
    const data=awardFixture(), stats=playerStats(data.participants,data.matches)
    render(<Live data={data} awards={awardLeaders(data)} fairness={fairness(stats)}/>)
    expect(screen.getByText(/시상은 개인별 먼저 출전한 5경기만 반영/)).toBeInTheDocument()
  })

  it('updates the displayed rule and rankings when the shared target changes',()=>{
    const data=awardFixture()
    data.settings.award_match_limit=4
    let stats=awardLeaders(data).stats
    const {rerender}=render(<><Rankings stats={stats} matchLimit={4}/><Live data={data} awards={awardLeaders(data)} fairness={fairness(stats)}/></>)
    expect(screen.getAllByText(/먼저 출전한 4경기만 반영/)).toHaveLength(2)
    expect(within(screen.getByText('참가자1',{selector:'.table-row > span'}).closest<HTMLElement>('.table-row')!).getByLabelText('시상 반영 4경기 / 실제 완료 6경기')).toBeInTheDocument()
    data.settings.award_match_limit=6
    stats=awardLeaders(data).stats
    rerender(<><Rankings stats={stats} matchLimit={6}/><Live data={data} awards={awardLeaders(data)} fairness={fairness(stats)}/></>)
    expect(screen.getAllByText(/먼저 출전한 6경기만 반영/)).toHaveLength(2)
    expect(within(screen.getByText('참가자1',{selector:'.table-row > span'}).closest<HTMLElement>('.table-row')!).getByLabelText('시상 반영 6경기 / 실제 완료 6경기')).toBeInTheDocument()
  })
})
