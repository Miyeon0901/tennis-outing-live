import type { AppData, Match } from '../types'
import { demoData } from '../lib/demo'

export function awardFixture(): AppData {
  const data = structuredClone(demoData)
  const [p1,p2,p3,p4,p5] = data.participants
  const scores = [[6,1],[1,6],[6,4],[3,3],[2,6],[6,0]]
  data.matches = scores.map(([a,b],i): Match => ({
    ...data.matches[0], id:`award-${i+1}`, match_number:60-i*10,
    started_at:new Date(Date.UTC(2026,10,21,0,i*30)).toISOString(),
    finished_at:new Date(Date.UTC(2026,10,21,0,i*30+25)).toISOString(),
    status:'finished', team_a_score:a, team_b_score:b,
    team_a:[p1,p2], team_b:[i===4?p5:p3,p4],
  }))
  return data
}
