import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../types'
import { awardFixture } from '../test/awardFixture'
import { awardLeaders } from '../lib/stats'
import { useAppData } from './useAppData'

const server=vi.hoisted(()=>({data:null as AppData|null,rpc:vi.fn(),listener:null as (()=>void)|null}))

vi.mock('../lib/supabase',()=>({
  isSupabaseConfigured:true,
  supabase:{
    from:(table:string)=>{
      const data=server.data!
      const rows:Record<string,unknown>={participants:data.participants,rounds:data.rounds,matches:data.matches,
        match_players:data.matches.flatMap(m=>(['A','B'] as const).flatMap(team=>(team==='A'?m.team_a:m.team_b).map(participant=>({match_id:m.id,team,participant})))),
        score_events:data.scoreEvents,settings:data.settings,fashion_votes:data.fashionVotes,lucky_draws:data.luckyDraws}
      return Object.assign(Promise.resolve({data:rows[table],error:null}),{
        select(){return this},order(){return this},eq(){return this},single(){return this},limit(){return this},
      })
    },
    rpc:server.rpc,
    channel:()=>({on(_event:string,_filter:unknown,callback:()=>void){server.listener=callback;return this},subscribe(){return this}}),
    removeChannel:vi.fn(),
  },
}))

beforeEach(()=>{server.data=awardFixture();server.rpc.mockReset();server.listener=null})
afterEach(cleanup)

describe('persisted shared award target',()=>{
  it('saves through the authenticated RPC and reloads the same value in another session',async()=>{
    const {result,unmount}=renderHook(()=>useAppData('운영자'))
    await waitFor(()=>expect(result.current.loading).toBe(false))
    server.rpc.mockImplementation(async(_name:string,args:{p_match_limit:number})=>{
      server.data!.settings.award_match_limit=args.p_match_limit
      return {data:{...server.data!.settings},error:null}
    })
    await act(async()=>{await result.current.setAwardMatchLimit(4,'valid-pin')})
    expect(server.rpc).toHaveBeenCalledWith('set_award_match_limit',{p_match_limit:4,p_admin_token:'valid-pin'})
    expect(awardLeaders(result.current.data).stats[0]).toMatchObject({awardCompleted:4,awardExcluded:2,scored:16})
    unmount()
    const next=renderHook(()=>useAppData('별도 접속자'))
    await waitFor(()=>expect(next.result.current.loading).toBe(false))
    expect(next.result.current.data.settings.award_match_limit).toBe(4)
    expect(awardLeaders(next.result.current.data).stats[0].awardCompleted).toBe(4)
  })

  it('recalculates when a settings realtime notification loads another operator’s change',async()=>{
    const {result}=renderHook(()=>useAppData('참가자'))
    await waitFor(()=>expect(result.current.loading).toBe(false))
    expect(awardLeaders(result.current.data).stats[0].awardCompleted).toBe(5)
    // Replace the server row; do not mutate the already-loaded client object.
    server.data={...server.data!,settings:{...server.data!.settings,award_match_limit:6}}
    await act(async()=>{server.listener!()})
    await waitFor(()=>expect(result.current.data.settings.award_match_limit).toBe(6))
    expect(awardLeaders(result.current.data).stats[0]).toMatchObject({awardCompleted:6,awardExcluded:0,scored:24})
  })

  it('does not change the local setting when the server rejects a save',async()=>{
    const {result}=renderHook(()=>useAppData('운영자'))
    await waitFor(()=>expect(result.current.loading).toBe(false))
    server.rpc.mockResolvedValue({data:null,error:{message:'관리자 PIN이 올바르지 않습니다.'}})
    await expect(result.current.setAwardMatchLimit(3,'wrong')).rejects.toThrow('관리자 PIN')
    expect(result.current.data.settings.award_match_limit).toBe(5)
    expect(awardLeaders(result.current.data).stats[0].awardCompleted).toBe(5)
  })
})
