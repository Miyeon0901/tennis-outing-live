import { useCallback, useEffect, useState } from 'react'
import { demoData } from '../lib/demo'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { AppData, Match, Team } from '../types'

const cloneDemo = () => structuredClone(demoData)

export function useAppData(userName: string) {
  const [data, setData] = useState<AppData>(cloneDemo)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const [p, r, m, mp, e, s, v, d] = await Promise.all([
      supabase.from('participants').select('*').order('name'),
      supabase.from('rounds').select('*').order('round_number'),
      supabase.from('matches').select('*').order('match_number'),
      supabase.from('match_players').select('match_id,team,position,participant:participants(*)').order('position'),
      supabase.from('score_events').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('fashion_votes').select('*'),
      supabase.from('lucky_draws').select('*').order('drawn_at', { ascending: false }),
    ])
    const failure = [p,r,m,mp,e,s,v,d].find(x => x.error)?.error
    if (failure) { setError(failure.message); setLoading(false); return }
    const players = mp.data as unknown as Array<{ match_id: string; team: Team; participant: AppData['participants'][number] }>
    const matches = (m.data ?? []).map(row => ({ ...row,
      team_a: players.filter(x => x.match_id === row.id && x.team === 'A').map(x => x.participant),
      team_b: players.filter(x => x.match_id === row.id && x.team === 'B').map(x => x.participant),
    })) as Match[]
    setData({ participants: p.data ?? [], rounds: r.data ?? [], matches, scoreEvents: e.data ?? [], settings: s.data, fashionVotes: v.data ?? [], luckyDraws: d.data ?? [] })
    setError(null); setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const client = supabase
    if (!client) return
    const channel = client.channel('tennis-live').on('postgres_changes', { event: '*', schema: 'public' }, load).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [load])

  const changeScore = async (matchId: string, team: Team, delta: number) => {
    if (supabase) {
      const { error } = await supabase.rpc('change_score', { p_match_id: matchId, p_team: team, p_delta: delta, p_created_by: userName })
      if (error) throw error
    } else setData(prev => ({ ...prev, matches: prev.matches.map(m => m.id !== matchId ? m : ({ ...m,
      team_a_score: team === 'A' ? Math.max(0, m.team_a_score + delta) : m.team_a_score,
      team_b_score: team === 'B' ? Math.max(0, m.team_b_score + delta) : m.team_b_score,
      updated_at: new Date().toISOString(), updated_by: userName })), scoreEvents: [{ id: crypto.randomUUID(), match_id: matchId, team, delta, created_at: new Date().toISOString(), created_by: userName }, ...prev.scoreEvents] }))
  }
  const setStatus = async (matchId: string, status: Match['status'], adminToken?: string) => {
    if (supabase) {
      const { error } = await supabase.rpc('set_match_status', { p_match_id: matchId, p_status: status, p_updated_by: userName, p_admin_token: adminToken ?? null })
      if (error) throw error
    } else setData(prev => ({ ...prev, matches: prev.matches.map(m => m.id === matchId ? { ...m, status, started_at: status === 'playing' ? (m.started_at ?? new Date().toISOString()) : m.started_at, finished_at: status === 'finished' ? new Date().toISOString() : null, updated_at: new Date().toISOString(), updated_by: userName } : m) }))
  }
  const vote = async (voterId: string, candidateId: string) => {
    if (supabase) { const { error } = await supabase.rpc('cast_fashion_vote', { p_voter_id: voterId, p_candidate_id: candidateId }); if (error) throw error }
    else setData(prev => ({ ...prev, fashionVotes: [...prev.fashionVotes.filter(v => v.voter_id !== voterId), { voter_id: voterId, candidate_id: candidateId }] }))
  }
  const verifyAdmin = async (pin: string) => {
    if (!supabase) return pin === '1121'
    const { data: ok, error } = await supabase.rpc('verify_admin_pin', { p_pin: pin })
    if (error) throw error
    return Boolean(ok)
  }
  const loginParticipant = async (name: string, phoneLast4: string) => {
    if (!supabase) {
      const participant = data.participants.find(p => p.is_active && p.name === name)
      if (!participant) return null
      return phoneLast4 === '0000' ? participant : null
    }
    const { data: rows, error } = await supabase.rpc('login_participant', { p_name: name, p_phone_last4: phoneLast4 })
    if (error) throw error
    const row = rows?.[0]
    return row ? data.participants.find(p => p.id === row.participant_id) ?? null : null
  }
  const admin = async (action: string, payload: Record<string, unknown>, token: string) => {
    if (!supabase) { await demoAdmin(action, payload); return }
    const { error } = await supabase.rpc('admin_action', { p_action: action, p_payload: payload, p_admin_token: token, p_updated_by: userName })
    if (error) throw error
  }
  const resetEventData = async (token: string) => {
    if (!supabase) { await demoAdmin('reset_scores', {}); return }
    const { error } = await supabase.rpc('reset_event_data', { p_admin_token: token, p_updated_by: userName })
    if (error) throw error
    await load()
  }
  const demoAdmin = async (action: string, payload: Record<string, unknown>) => setData(prev => {
    if (action === 'add_participant') return { ...prev, participants: [...prev.participants, { id: crypto.randomUUID(), name: String(payload.name), gender: (payload.gender as AppData['participants'][number]['gender']) ?? 'unspecified', is_active: true }] }
    if (action === 'toggle_participant') return { ...prev, participants: prev.participants.map(p => p.id === payload.id ? { ...p, is_active: !p.is_active } : p) }
    if (action === 'update_participant') return { ...prev, participants: prev.participants.map(p => p.id === payload.id ? { ...p, name: String(payload.name).trim(), gender: (payload.gender as AppData['participants'][number]['gender']) ?? p.gender } : p) }
    if (action === 'vote_status') return { ...prev, settings: { ...prev.settings, fashion_vote_status: payload.status as AppData['settings']['fashion_vote_status'] } }
    if (action === 'setting') return { ...prev, settings: { ...prev.settings, [String(payload.key)]: payload.value } }
    if (action === 'reset_scores') return { ...prev, rounds: [], matches: [], scoreEvents: [], fashionVotes: [], luckyDraws: [], settings: { ...prev.settings, current_round: 1, fashion_vote_status: 'not_started', reveal_fashion_during_vote: false } }
    if (action === 'lucky_draw') { const pool = prev.participants.filter(p => prev.matches.some(m => m.status==='finished' && [...m.team_a,...m.team_b].some(x=>x.id===p.id))); const winner=pool[Math.floor(Math.random()*pool.length)]; return winner ? { ...prev, luckyDraws: [{ id: crypto.randomUUID(), winner_id: winner.id, pool_type: String(payload.pool_type), exclude_award_winners: Boolean(payload.exclude_award_winners), drawn_at: new Date().toISOString(), drawn_by: userName }, ...prev.luckyDraws] } : prev }
    if (action === 'create_match') {
      const ids = payload.players as string[], byId = (id: string) => prev.participants.find(p => p.id === id)!
      return { ...prev, matches: [...prev.matches, { id: crypto.randomUUID(), match_number: Number(payload.match_number), court_number: Number(payload.court_number), round_id: String(payload.round_id || '') || null, order_index: Number(payload.order_index || 0), status: 'waiting', team_a_score: 0, team_b_score: 0, started_at: null, finished_at: null, updated_at: new Date().toISOString(), updated_by: userName, team_a: ids.slice(0,2).map(byId), team_b: ids.slice(2).map(byId) }] }
    }
    if (action === 'generate_schedule') {
      const generated = payload.rounds as Array<{roundNumber:number;rests:string[];matches:Array<{court:number;matchNumber:number;teamA:string[];teamB:string[]}>}>
      const byId = (id:string)=>prev.participants.find(p=>p.id===id)!
      const rounds = generated.map(r=>({id:`demo-r${r.roundNumber}`,round_number:r.roundNumber,label:`ROUND ${r.roundNumber}`,status:'waiting' as const,rest_participant_ids:r.rests}))
      const matches = generated.flatMap(r=>r.matches.map(g=>({id:crypto.randomUUID(),match_number:g.matchNumber,court_number:g.court,round_id:`demo-r${r.roundNumber}`,order_index:r.roundNumber,status:'waiting' as const,team_a_score:0,team_b_score:0,started_at:null,finished_at:null,updated_at:new Date().toISOString(),updated_by:userName,team_a:g.teamA.map(byId),team_b:g.teamB.map(byId)})))
      return {...prev,rounds,matches}
    }
    return prev
  })
  return { data, loading, error, isDemo: !isSupabaseConfigured, changeScore, setStatus, vote, verifyAdmin, loginParticipant, admin, resetEventData, refresh: load }
}
