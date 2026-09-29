import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Gift, ListOrdered, LockKeyhole, MapPin, Radio, Settings, Trophy } from 'lucide-react'
import { useAppData } from './hooks/useAppData'
import { awardLeaders, fairness, playerStats } from './lib/stats'
import Courts from './components/Courts'
import Schedule from './components/Schedule'
import Live from './components/Live'
import Rankings from './components/Rankings'
import Events from './components/Events'
import Admin from './components/Admin'

type Tab = 'courts' | 'schedule' | 'live' | 'rankings' | 'events' | 'admin'
const tabs: Array<{ id: Tab; label: string; icon: typeof Radio }> = [
  { id: 'courts', label: '코트', icon: Radio }, { id: 'schedule', label: '대진', icon: CalendarDays },
  { id: 'live', label: 'LIVE', icon: Trophy }, { id: 'rankings', label: '전체순위', icon: ListOrdered },
  { id: 'events', label: '이벤트', icon: Gift }, { id: 'admin', label: '관리', icon: Settings },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('courts')
  const [name, setName] = useState(() => localStorage.getItem('tennis-user-name') ?? '')
  const [nameInput, setNameInput] = useState('')
  const api = useAppData(name || '익명')
  const stats = useMemo(() => playerStats(api.data.participants, api.data.matches), [api.data.participants, api.data.matches])
  const awards = useMemo(() => awardLeaders(api.data), [api.data])
  const fair = useMemo(() => fairness(stats), [stats])
  const finished = api.data.matches.filter(m => m.status === 'finished').length
  const courtRound = (court: number) => {
    const match = api.data.matches.find(m => m.court_number === court && m.status === 'playing') ?? api.data.matches.find(m => m.court_number === court && m.status === 'waiting')
    return api.data.rounds.find(r => r.id === match?.round_id)?.round_number ?? '-'
  }

  const chooseName = (value: string) => { const clean = value.trim(); if (!clean) return; localStorage.setItem('tennis-user-name', clean); setName(clean) }
  if (api.loading) return <div className="splash"><div className="ball-loader">🎾</div><p>코트 현황을 불러오는 중…</p></div>

  return <div className="app-shell">
    <header className="topbar">
      <div><p className="eyebrow">KONKUK SPORTS TOWN · 2026</p><h1>{api.data.settings.event_title}</h1></div>
      <button className="user-chip" onClick={() => setName('')}>{name || '이름 선택'}</button>
    </header>
    <div className="event-strip">
      <span><MapPin size={15}/>{api.data.settings.venue}</span><span><CalendarDays size={15}/>11.21 SAT · 07:00–11:00</span>
      <span className="live-dot"><i/> 실시간 연결</span>
    </div>
    {api.isDemo && <div className="demo-banner"><strong>데모 모드</strong> 환경변수를 연결하면 Supabase 실시간 모드로 전환됩니다.</div>}
    {api.error && <div className="error-banner">연결 오류: {api.error}</div>}
    <main>
      <section className="summary-row">
        <div className="court-round-summary"><small>코트별 현재 라운드</small><strong>{[1,2,3].map(c=><span key={c}>{c}코트 <b>R{courtRound(c)}</b></span>)}</strong></div>
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
    {!name && <div className="modal-backdrop"><form className="name-modal" onSubmit={e => { e.preventDefault(); chooseName(nameInput) }}>
      <div className="modal-mark">🎾</div><p className="eyebrow">WELCOME TO THE COURT</p><h2>오늘 사용할 이름을 알려주세요</h2><p>점수 변경 기록에 표시되며 이 기기에 저장됩니다.</p>
      <input autoFocus value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="이름 입력" maxLength={20}/>
      <button className="primary" disabled={!nameInput.trim()}>입장하기</button>
      <div className="quick-names">{api.data.participants.slice(0,6).map(p=><button type="button" key={p.id} onClick={()=>chooseName(p.name)}>{p.name}</button>)}</div>
    </form></div>}
  </div>
}
