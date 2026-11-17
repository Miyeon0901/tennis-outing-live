import { describe, expect, it } from 'vitest'
import { demoData } from './demo'
import { awardLeaders, fairness, playerStats } from './stats'
import { generateBalancedGames, generateBalancedRounds, recommendPlayers } from './generator'
import type { Gender, Match, MatchStatus, Participant } from '../types'

describe('doubles participation',()=>{
  const player: Participant = { id: 'player', name: '참가자', gender: 'male', is_active: true }
  const makeMatch = (genders: Gender[], status: MatchStatus): Match => {
    const players = genders.map((gender,i)=>({...player,id:i===0?player.id:`other-${i}`,gender}))
    return {...demoData.matches[0],status,team_a:players.slice(0,2),team_b:players.slice(2)}
  }

  it.each([
    ['same',['male','male','male','male']],
    ['same',['female','female','female','female']],
    ['mixed',['male','female','female','male']],
    ['unclassified',['male','male','female','female']],
    ['unclassified',['male','unspecified','male','female']],
    ['unclassified',['male','female','male']],
  ] as const)('counts %s doubles by status for %j',(category,genders)=>{
    const matches = (['finished','playing','waiting','cancelled'] as const).map(status=>makeMatch([...genders],status))
    const stat = playerStats([player],matches)[0]
    expect(stat.doublesParticipation[category]).toEqual({completed:1,playing:1,scheduled:1})
    Object.entries(stat.doublesParticipation).filter(([key])=>key!==category).forEach(([,counts])=>{
      expect(counts).toEqual({completed:0,playing:0,scheduled:0})
    })
    expect([stat.completed,stat.playing,stat.scheduled]).toEqual([1,1,1])
  })

  it('keeps unrelated matches out of a player’s counts',()=>{
    const match = makeMatch(['male','female','male','female'],'finished')
    const stat = playerStats([{...player,id:'absent'}],[match])[0]
    expect(stat.doublesParticipation.mixed.completed).toBe(0)
  })
})

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
  it('creates mixed doubles with one man and one woman on every team',()=>{
    const rounds=generateBalancedRounds(demoData.participants,3,1,'mixed')
    expect(rounds[0].matches).toHaveLength(3)
    rounds.flatMap(r=>r.matches).forEach(m=>[m.teamA,m.teamB].forEach(team=>expect(team.map(p=>p.gender).sort()).toEqual(['female','male'])))
  })
  it('creates the requested game count without assigning courts',()=>{
    const groups=generateBalancedGames(demoData.participants,4,1,'female')
    const games=groups.flatMap(group=>group.matches)
    expect(games).toHaveLength(4)
    games.forEach(game=>expect(game).not.toHaveProperty('court'))
    expect(games.map(game=>game.matchNumber)).toEqual([1,2,3,4])
  })
  it('plans four disjoint matches and one rest for 17 players, balancing a full rotation',()=>{
    const people:Participant[]=Array.from({length:17},(_,i)=>({id:`p${i}`,name:`참가자${i}`,gender:i%2?'female':'male',is_active:true}))
    const rounds=generateBalancedRounds(people,17)
    rounds.forEach(round=>{
      expect(round.matches).toHaveLength(4)
      expect(new Set(round.matches.flatMap(m=>[...m.teamA,...m.teamB].map(p=>p.id))).size).toBe(16)
      expect(round.rests).toHaveLength(1)
    })
    const counts=people.map(p=>rounds.filter(r=>r.matches.some(m=>[...m.teamA,...m.teamB].some(x=>x.id===p.id))).length)
    expect(new Set(counts)).toEqual(new Set([16]))
    const partial=generateBalancedGames(people,5)
    expect(partial.flatMap(r=>r.matches)).toHaveLength(5)
    expect(partial[1].rests).toHaveLength(13)
  })
  it('recommends non-playing players with fewer completed games first',()=>{
    const data=JSON.parse(JSON.stringify(demoData)) as typeof demoData; data.matches.forEach(m=>m.status='waiting'); const stats=playerStats(data.participants,data.matches); stats.forEach(s=>s.completed=3); stats[0].completed=5; stats[1].completed=1
    const picks=recommendPlayers(data.participants,stats,data.matches,4)
    expect(picks.map(p=>p.id)).toContain('p2'); expect(picks[0].id).not.toBe('p1')
  })
})
