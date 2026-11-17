import { describe, expect, it } from 'vitest'
import { awardFixture } from '../test/awardFixture'
import { awardAppearances, awardMatchLimit } from './awardParticipation'
import { awardLeaders, fairness, playerStats, ranked } from './stats'

describe('first five appearances count toward awards',()=>{
  it.each([
    [3,13,3,3],
    [4,16,4,2],
    [6,24,6,0],
  ])('recalculates the first %i appearances without changing real participation',(limit,scored,included,excluded)=>{
    const data=awardFixture()
    data.settings.award_match_limit=limit
    const stats=awardLeaders(data).stats
    expect(stats[0]).toMatchObject({completed:6,scored,awardCompleted:included,awardExcluded:excluded})
    expect(playerStats(data.participants,data.matches,limit)).toEqual(stats)
    expect(awardAppearances(data.matches,limit).get('award-6')?.[0].included).toBe(limit>=6)
  })

  it('falls back to five for legacy settings or invalid configuration',()=>{
    for(const value of [undefined,null,0,-1,1.5,NaN,Infinity,61,'4'])expect(awardMatchLimit(value)).toBe(5)
    const data=awardFixture()
    delete data.settings.award_match_limit
    expect(awardLeaders(data).stats[0]).toMatchObject({awardCompleted:5,awardExcluded:1})
  })

  it('excludes a sixth win from every award metric but retains actual participation',()=>{
    const data=awardFixture()
    const stat=playerStats(data.participants,data.matches)[0]
    expect(stat).toMatchObject({completed:6,awardCompleted:5,awardExcluded:1,totalParticipation:6,
      wins:2,losses:2,draws:1,scored:18,conceded:20,difference:-2,winRate:40})
    expect(stat.doublesParticipation.mixed.completed).toBe(6)
    expect(fairness([stat])).toMatchObject({min:6,max:6})
  })

  it('counts the same match for one player’s fifth appearance but excludes another player’s sixth',()=>{
    const data=awardFixture(), stats=playerStats(data.participants,data.matches)
    expect(awardAppearances(data.matches).get('award-6')).toEqual([
      {participantId:'p1',number:6,included:false},
      {participantId:'p2',number:6,included:false},
      {participantId:'p3',number:5,included:true},
      {participantId:'p4',number:6,included:false},
    ])
    expect(stats.find(s=>s.participant.id==='p3')).toMatchObject({completed:5,awardCompleted:5,awardExcluded:0,losses:3,scored:14,conceded:22})
  })

  it('uses actual starts rather than match numbers, array order, or finish recording order',()=>{
    const data=awardFixture()
    data.matches[0].finished_at='2026-11-22T00:00:00Z'
    const expected=playerStats(data.participants,data.matches)
    data.matches.reverse()
    expect(playerStats(data.participants,data.matches)).toEqual(expected)
    expect(awardAppearances(data.matches).get('award-6')?.[0].included).toBe(false)
  })

  it('does not consume places for waiting/cancelled matches or count unfinished scores',()=>{
    const data=awardFixture()
    data.matches[5].status='playing'
    data.matches.push(...(['waiting','cancelled'] as const).map(status=>({...data.matches[0],id:status,status,started_at:'2020-01-01T00:00:00Z'})))
    const stat=playerStats(data.participants,data.matches)[0]
    expect(stat).toMatchObject({completed:5,playing:1,scheduled:1,awardCompleted:5,awardExcluded:0,scored:18})
    const appearances=awardAppearances(data.matches)
    expect(appearances.has('waiting')).toBe(false)
    expect(appearances.has('cancelled')).toBe(false)
    expect(appearances.get('award-6')?.[0]).toMatchObject({number:6,included:false})
  })

  it('recalculates all award leaders after a counted correction, ignoring excluded corrections',()=>{
    const data=awardFixture()
    const before=awardLeaders(data)
    data.matches[5].team_a_score=100
    data.matches[5].team_b_score=200
    data.matches[5].updated_at='2027-01-01T00:00:00Z'
    const after=awardLeaders(data)
    for(const key of ['byScore','byWins','byLosses'] as const){
      const p1=(rows:typeof before[typeof key])=>rows.find(s=>s.participant.id==='p1')
      expect(p1(after[key])).toEqual(p1(before[key]))
    }
    data.matches[0].team_a_score=0
    data.matches[0].team_b_score=6
    expect(playerStats(data.participants,data.matches)[0]).toMatchObject({wins:1,losses:3,scored:12,conceded:25})
  })

  it('recalculates eligibility when an earlier match is cancelled or deleted',()=>{
    const data=awardFixture()
    data.matches[0].status='cancelled'
    expect(playerStats(data.participants,data.matches)[0]).toMatchObject({completed:5,awardCompleted:5,awardExcluded:0,scored:18})
    data.matches=data.matches.filter(m=>m.id!=='award-1')
    expect(awardAppearances(data.matches).get('award-6')?.[0]).toMatchObject({number:5,included:true})
  })

  it('does not use extra participation as a ranking tie-break',()=>{
    const [stat]=playerStats(awardFixture().participants,awardFixture().matches)
    const extra={...stat,completed:7,participant:{...stat.participant,id:'extra',name:'하'}}
    const regular={...stat,completed:5,participant:{...stat.participant,id:'regular',name:'가'}}
    expect(ranked([extra,regular],'wins').map(s=>s.participant.id)).toEqual(['regular','extra'])
  })

  it('handles legacy missing start times and uses deterministic tie-breaks',()=>{
    const data=awardFixture()
    data.matches.forEach(m=>{m.started_at=null})
    expect(awardAppearances(data.matches).get('award-6')?.[0].number).toBe(6)
    data.matches.forEach(m=>{m.finished_at=null})
    const forward=awardAppearances(data.matches)
    const reverse=awardAppearances([...data.matches].reverse())
    for(const [id,entries] of forward)expect(reverse.get(id)).toEqual(entries)
  })
})
