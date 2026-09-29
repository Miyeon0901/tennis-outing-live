import { describe, expect, it } from 'vitest'
import { demoData } from './demo'
import { awardLeaders, fairness, playerStats } from './stats'
import { generateBalancedRounds, recommendPlayers } from './generator'

describe('statistics',()=>{
  it('does not count scheduled matches as completed participation',()=>{const stats=playerStats(demoData.participants,demoData.matches);expect(stats.find(s=>s.participant.id==='p1')?.completed).toBe(0)})
  it('detects a two-game fairness gap',()=>{const stats=playerStats(demoData.participants,demoData.matches);stats[0].completed=5;stats[1].completed=3;expect(fairness(stats).spread).toBeGreaterThanOrEqual(2)})
  it('recalculates awards from edited finished match scores',()=>{
    const data=JSON.parse(JSON.stringify(demoData)) as typeof demoData; data.matches[0].status='finished'; data.matches[0].team_a_score=5; data.matches[0].team_b_score=2
    expect(awardLeaders(data).scoring.map(s=>s.participant.id)).toEqual(['p1','p2'])
    data.matches[0].team_a_score=1; data.matches[0].team_b_score=6
    expect(awardLeaders(data).scoring.map(s=>s.participant.id)).toEqual(['p3','p4'])
    expect(awardLeaders(data).winning.map(s=>s.participant.id)).toEqual(['p3','p4'])
  })
  it('creates 3 courts with 12 unique players and balances rest',()=>{
    const rounds=generateBalancedRounds(demoData.participants,7)
    expect(rounds).toHaveLength(7)
    rounds.forEach(r=>{const ids=r.matches.flatMap(m=>[...m.teamA,...m.teamB].map(p=>p.id));expect(r.matches).toHaveLength(3);expect(new Set(ids).size).toBe(12);expect(r.rests).toHaveLength(2)})
    const counts=demoData.participants.map(p=>rounds.filter(r=>r.matches.some(m=>[...m.teamA,...m.teamB].some(x=>x.id===p.id))).length)
    expect(Math.max(...counts)-Math.min(...counts)).toBeLessThanOrEqual(1)
  })
  it('recommends non-playing players with fewer completed games first',()=>{
    const data=JSON.parse(JSON.stringify(demoData)) as typeof demoData; data.matches.forEach(m=>m.status='waiting'); const stats=playerStats(data.participants,data.matches); stats.forEach(s=>s.completed=3); stats[0].completed=5; stats[1].completed=1
    const picks=recommendPlayers(data.participants,stats,data.matches,4)
    expect(picks.map(p=>p.id)).toContain('p2'); expect(picks[0].id).not.toBe('p1')
  })
})
