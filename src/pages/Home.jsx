import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function Home({ session }) {
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [balances, setBalances] = useState({ owe: 0, owed: 0 })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!data || !data.name) { navigate('/setup'); return }
    setProfile(data)
    await Promise.all([fetchGroups(), fetchBalances(), fetchRecent()])
    setLoading(false)
  }

  async function fetchGroups() {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, invite_code)')
      .eq('user_id', session.user.id)
    if (data) setGroups(data.map(d => d.groups).filter(Boolean))
  }

  async function fetchBalances() {
    const { data: splits } = await supabase
      .from('expense_splits')
      .select('amount, settled, expenses(paid_by, amount)')
      .eq('user_id', session.user.id).eq('settled', false)

    let owe = 0
    splits?.forEach(s => { if (s.expenses?.paid_by !== session.user.id) owe += s.amount })

    const { data: myExp } = await supabase.from('expenses').select('id, amount').eq('paid_by', session.user.id)
    let owed = 0
    if (myExp) {
      for (const exp of myExp) {
        const { data: ms } = await supabase.from('expense_splits').select('amount').eq('expense_id', exp.id).eq('settled', false).neq('user_id', session.user.id)
        ms?.forEach(s => { owed += s.amount })
      }
    }
    setBalances({ owe: Math.round(owe), owed: Math.round(owed) })
  }

  async function fetchRecent() {
    const { data } = await supabase
      .from('expense_splits')
      .select('amount, settled, expenses(id, description, amount, paid_by, created_at, group_id, groups(name))')
      .eq('user_id', session.user.id)
      .order('id', { ascending: false })
      .limit(5)
    if (data) setRecentExpenses(data.filter(d => d.expenses).map(d => d.expenses))
  }

  function shareInvite(group) {
    const url = `${window.location.origin}/join/${group.invite_code}`
    if (navigator.share) navigator.share({ title: `Join ${group.name} on splitr`, url })
    else { navigator.clipboard.writeText(url); alert('Invite link copied!') }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>Loading...</div>
  const initial = (profile?.name || '?')[0].toUpperCase()

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={s.menuBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span style={s.logoText}>splitr</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={s.avatarBtn}>
          {initial}
        </button>
      </div>

      <div style={s.scroll}>
        <div style={s.balRow}>
          <div style={s.balCard} className="glass-panel">
            <div style={s.balCardLabel}>YOU OWE</div>
            <div style={{ ...s.balCardAmt, color: balances.owe > 0 ? C.red : C.white }}>
              ₹{balances.owe.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={s.balCard} className="glass-panel">
            <div style={s.balCardLabel}>OWED TO YOU</div>
            <div style={{ ...s.balCardAmt, color: balances.owed > 0 ? C.teal : C.white }}>
              ₹{balances.owed.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Groups</span>
            <button style={s.viewAllBtn} onClick={() => navigate('/create-group')}>+ New</button>
          </div>

          {groups.length === 0 ? (
            <div style={s.emptyCard} className="glass-panel" onClick={() => navigate('/create-group')}>
              <p style={{ fontSize: '14px', color: C.gray1 }}>no groups yet — create one</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.id} style={s.groupCard} className="glass-panel fadeUp" onClick={() => navigate(`/group/${group.id}`)}>
                <div style={s.groupAvatar}>{group.name[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={s.groupName}>{group.name}</div>
                  <div style={s.groupSub}>tap to view</div>
                </div>
                <button style={s.inviteChip} onClick={e => { e.stopPropagation(); shareInvite(group) }}>
                  invite
                </button>
              </div>
            ))
          )}
        </div>

        {recentExpenses.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Recent Activity</span>
            </div>
            {recentExpenses.map((exp, i) => (
              <div key={exp.id || i} style={s.actRow}>
                <div style={s.actIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM13 17h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.actName}>{exp.description}</div>
                  <div style={s.actMeta}>{exp.groups?.name} · {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ ...s.actAmt, color: exp.paid_by === session.user.id ? C.teal : C.red }}>
                  {exp.paid_by === session.user.id ? '+' : '-'}₹{Number(exp.amount).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={s.bottomNav} className="glass-nav">
        <NavBtn icon={<HomeIcon />} label="Home" active />
        <NavBtn icon={<GroupIcon />} label="Groups" onClick={() => navigate('/friends')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button style={s.fab} onClick={() => groups.length > 0 ? navigate(`/add/${groups[0].id}`) : navigate('/create-group')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <span style={s.fabLabel}>Add</span>
        </div>
        <NavBtn icon={<ScanIcon />} label="Scan" onClick={() => navigate('/scan')} />
        <NavBtn icon={<SettleIcon />} label="Settle" onClick={() => groups.length > 0 ? navigate(`/settle/${groups[0].id}`) : {}} />
      </div>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={s.navBtn(active)}>
      <span style={{ color: active ? C.teal : '#555' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> }
function GroupIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg> }
function ScanIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> }
function SettleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> }

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    width: '100%',      // Fill the 480px root
    background: 'none',  // Let the body background show through
    margin: '0'          // Remove auto margin here
  },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 },
  menuBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' },
  logoText: { fontSize: '22px', fontWeight: '800', color: '#00D4AA', letterSpacing: '-0.5px' },
  avatarBtn: { width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: '#00D4AA', fontWeight: '700', fontSize: '15px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' },
  scroll: { flex: 1, overflowY: 'auto', padding: '8px 0', paddingBottom: '100px' },
  balRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '8px 20px 16px' },
  balCard: { borderRadius: '20px', padding: '16px' },
  balCardLabel: { fontSize: '10px', fontWeight: '700', color: '#888', letterSpacing: '0.1em', marginBottom: '8px' },
  balCardAmt: { fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px' },
  section: { padding: '0 20px', marginBottom: '8px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  sectionTitle: { fontSize: '18px', fontWeight: '800', color: '#fff' },
  viewAllBtn: { fontSize: '13px', color: '#00D4AA', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' },
  groupCard: { display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '18px', padding: '16px', marginBottom: '12px', cursor: 'pointer' },
  groupAvatar: { width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(0, 212, 170, 0.2)' },
  groupName: { fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '2px' },
  groupSub: { fontSize: '12px', color: '#666' },
  inviteChip: { fontSize: '11px', color: '#00D4AA', background: 'rgba(0, 212, 170, 0.15)', border: '1px solid rgba(0, 212, 170, 0.3)', borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', fontWeight: '600' },
  emptyCard: { borderRadius: '14px', padding: '24px', border: '1.5px dashed rgba(255,255,255,0.1)', cursor: 'pointer', textAlign: 'center' },
  actRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  actIcon: { width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actName: { fontSize: '14px', fontWeight: '600', color: '#fff' },
  actMeta: { fontSize: '11px', color: '#666' },
  actAmt: { fontSize: '15px', fontWeight: '800' },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', display: 'flex', alignItems: 'flex-end', padding: '8px 0 20px', zIndex: 100 },
  navBtn: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: active ? '#00D4AA' : '#555', fontSize: '10px', fontWeight: active ? '700' : '500', padding: '4px 0' }),
  fab: { width: '56px', height: '56px', borderRadius: '18px', background: '#00D4AA', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0, 212, 170, 0.4)', transform: 'translateY(-5px)' },
  fabLabel: { fontSize: '10px', color: '#00D4AA', marginTop: '2px', fontWeight: '700' },
}