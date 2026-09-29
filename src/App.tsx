import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Gift, ListOrdered, LockKeyhole, MapPin, Radio, Settings, Trophy } from 'lucide-react'
import { useAppData } from './hooks/useAppData'
import { awardLeaders, fairness, playerStats } from './lib/stats'
import Courts from './components/Courts'
import Schedule from './components/Schedule'
import Live from './components/Live'
import Rankings from './components/Rankings'
import Events from './components/Events'
import Admin from './components/Admin'
import { courtLabel } from './lib/courts'

type Tab = 'courts' | 'schedule' | 'live' | 'rankings' | 'events' | 'admin'
const tabs: Array<{ id: Tab; label: string; icon: typeof Radio }> = [
  { id: 'courts', label: '코트', icon: Radio }, { id: 'schedule', label: '대진', icon: CalendarDays },
  { id: 'live', label: 'LIVE', icon: Trophy }, { id: 'rankings', label: '전체순위', icon: ListOrdered },
  { id: 'events', label: '이벤트', icon: Gift }, { id: 'admin', label: '관리', icon: Settings },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('courts')
  const [session, setSession] = useState<{id:string;name:string}|null>(() => {
    try { return JSON.parse(localStorage.getItem('tennis-participant-session') ?? 'null') } catch { return null }
  })
  const [loginName, setLoginName] = useState('')
  const [phoneLast4, setPhoneLast4] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const name = session?.name ?? ''
  const api = useAppData(name || '익명')
  const stats = useMemo(() => playerStats(api.data.participants, api.data.matches), [api.data.participants, api.data.matches])
  const awards = useMemo(() => awardLeaders(api.data), [api.data])
  const fair = useMemo(() => fairness(stats), [stats])
  const finished = api.data.matches.filter(m => m.status === 'finished').length
  const courtGame = (court: number) => {
    const match = api.data.matches.find(m => m.court_number === court && m.status === 'playing') ?? api.data.matches.find(m => m.court_number === court && m.status === 'waiting')
    return match?.match_number ?? '-'
  }

  const login = async () => {
    const cleanName=loginName.trim()
    if (!cleanName || !/^\d{4}$/.test(phoneLast4)) return setLoginError('이름과 휴대폰 번호 뒷자리 4개를 입력해주세요.')
    setLoggingIn(true); setLoginError('')
    try {
      const verified = await api.loginParticipant(cleanName,phoneLast4)
      if (!verified) return setLoginError('이름 또는 휴대폰 번호 뒷자리가 일치하지 않습니다.')
      const next={id:verified.id,name:verified.name}; localStorage.setItem('tennis-participant-session',JSON.stringify(next)); localStorage.removeItem('tennis-user-name'); setSession(next); setPhoneLast4('')
    } catch(e) { setLoginError(e instanceof Error?e.message:'로그인하지 못했습니다.') }
    finally { setLoggingIn(false) }
  }
  const logout=()=>{localStorage.removeItem('tennis-participant-session');setSession(null);setLoginName('');setPhoneLast4('')}
  const enterAdmin=()=>{setSession({id:'admin',name:'관리자'});setTab('admin');setLoginError('')}
  useEffect(()=>{
    if(api.loading||!session||session.id==='admin')return
    const active=api.data.participants.some(p=>p.id===session.id&&p.name===session.name&&p.is_active)
    if(!active)logout()
  },[api.loading,api.data.participants,session])
  if (api.loading) return <div className="splash"><div className="ball-loader">🎾</div><p>코트 현황을 불러오는 중…</p></div>

  if(!session)return <div className="login-shell"><form className="name-modal" onSubmit={e => { e.preventDefault(); void login() }}>
    <div className="modal-mark">🎾</div><p className="eyebrow">WELCOME TO THE COURT</p><h2>참가자 로그인</h2><p>등록된 이름과 휴대폰 번호 뒷자리 4개를 입력해주세요.</p>
    <input autoFocus value={loginName} onChange={e=>setLoginName(e.target.value)} placeholder="참가자 이름" maxLength={30}/>
    <input type="password" inputMode="numeric" autoComplete="off" value={phoneLast4} onChange={e=>setPhoneLast4(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="휴대폰 번호 뒷자리 4개" maxLength={4}/>
    {loginError&&<p className="login-error">{loginError}</p>}
    <button className="primary" disabled={loggingIn||!loginName.trim()||phoneLast4.length!==4}>{loggingIn?'확인 중…':'입장하기'}</button>
    <button type="button" className="ghost admin-entry" onClick={enterAdmin}>관리자 모드</button>
    {api.isDemo&&<small>샘플 로그인: 참가자1 / 0000</small>}
  </form></div>

  return <div className="app-shell">
    <header className="topbar">
      <div><p className="eyebrow">KONKUK SPORTS TOWN · 2026</p><h1>{api.data.settings.event_title}</h1></div>
      <button className="user-chip" onClick={logout}>{name || '로그인'}</button>
    </header>
    <div className="event-strip">
      <span><MapPin size={15}/>{api.data.settings.venue}</span><span><CalendarDays size={15}/>11.21 SAT · 07:00–11:00</span>
      <span className="live-dot"><i/> 실시간 연결</span>
    </div>
    {api.isDemo && <div className="demo-banner"><strong>데모 모드</strong> 환경변수를 연결하면 Supabase 실시간 모드로 전환됩니다.</div>}
    {api.error && <div className="error-banner">연결 오류: {api.error}</div>}
    <main>
      <section className="summary-row">
        <div className="court-round-summary"><small>코트별 현재 경기</small><strong>{[1,2,3].map(c=><span key={c}>{courtLabel(c)}코트 <b>#{courtGame(c)}</b></span>)}</strong></div>
        <div><small>경기 진행</small><strong>{finished} <em>/ {api.data.matches.length}</em></strong></div>
        <div><small>참여 편차</small><strong>{fair.spread}경기</strong></div>
      </section>
      {tab === 'courts' && <Courts data={api.data} onScore={api.changeScore} onStatus={api.setStatus} />}
      {tab === 'schedule' && <Schedule data={api.data} stats={stats} fairness={fair} />}
      {tab === 'live' && <Live data={api.data} awards={awards} fairness={fair} />}
      {tab === 'rankings' && <Rankings stats={stats} />}
      {tab === 'events' && <Events data={api.data} stats={stats} onVote={api.vote} userName={name} />}
      {tab === 'admin' && <Admin api={api} stats={stats} />}
    </main>
    <nav className="bottom-nav" aria-label="주 메뉴">{tabs.map(({id,label,icon:Icon}) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={21}/><span>{label}</span></button>)}</nav>
  </div>
}
