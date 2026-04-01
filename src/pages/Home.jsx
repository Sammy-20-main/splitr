import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C, glass, glassDark } from '../theme'

export default function Home({ session }) {
  const [profile,        setProfile]        = useState(null)
  const [groups,         setGroups]         = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [balances,       setBalances]       = useState({ owe:0, owed:0 })
  const [loading,        setLoading]        = useState(true)
  const [deletingGroup,  setDeletingGroup]  = useState(null)
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
      .select('group_id, groups(id, name, invite_code, created_by)')
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
    const { data: myExp } = await supabase.from('expenses').select('id').eq('paid_by', session.user.id)
    let owed = 0
    if (myExp) {
      for (const exp of myExp) {
        const { data: ms } = await supabase.from('expense_splits').select('amount')
          .eq('expense_id', exp.id).eq('settled', false).neq('user_id', session.user.id)
        ms?.forEach(s => { owed += s.amount })
      }
    }
    setBalances({ owe: Math.round(owe), owed: Math.round(owed) })
  }

  async function fetchRecent() {
    const { data } = await supabase
      .from('expense_splits')
      .select('amount, expenses(id, description, amount, paid_by, created_at, group_id, groups(name))')
      .eq('user_id', session.user.id)
      .order('id', { ascending: false })
      .limit(4)
    if (data) setRecentExpenses(data.filter(d => d.expenses).map(d => d.expenses))
  }

  async function handleDeleteGroup(group) {
    const confirmed = window.confirm(
      `Delete "${group.name}"?\n\nThis will permanently delete the group, all expenses, and all splits. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingGroup(group.id)
    try {
      // delete expense_splits → comments → expenses → group_members → groups
      const { data: expenses } = await supabase
        .from('expenses').select('id').eq('group_id', group.id)

      if (expenses?.length) {
        const expIds = expenses.map(e => e.id)
        await supabase.from('expense_splits').delete().in('expense_id', expIds)
        await supabase.from('comments').delete().in('expense_id', expIds)
        await supabase.from('expenses').delete().eq('group_id', group.id)
      }

      await supabase.from('group_members').delete().eq('group_id', group.id)
      await supabase.from('groups').delete().eq('id', group.id)

      setGroups(prev => prev.filter(g => g.id !== group.id))
    } catch (err) {
      alert('Failed to delete group: ' + err.message)
    }
    setDeletingGroup(null)
  }

  function shareInvite(group, e) {
    e.stopPropagation()
    const url = `${window.location.origin}/join/${group.invite_code}`
    if (navigator.share) navigator.share({ title:`Join ${group.name} on splitr`, url })
    else { navigator.clipboard.writeText(url); alert('Invite link copied!') }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:C.bg }}>
      <p style={{ color:C.gray2 }}>loading...</p>
    </div>
  )

  const initial = (profile?.name || '?')[0].toUpperCase()

  return (
    <div style={s.page}>
      {/* topbar */}
      <div style={s.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={s.logoText}>splitr</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={s.avatarBtn} title="sign out">
          {initial}
        </button>
      </div>

      <div style={s.scroll}>
        {/* balance cards */}
        <div style={s.balRow}>
          <div style={{ ...s.balCard, ...glass }} className="slideUp">
            <div style={s.balCardLabel}>YOU OWE</div>
            <div style={{ ...s.balCardAmt, color: balances.owe > 0 ? C.red : C.white }}>
              ₹{balances.owe.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ ...s.balCard, ...glass, animationDelay:'0.07s' }} className="slideUp">
            <div style={s.balCardLabel}>OWED TO YOU</div>
            <div style={{ ...s.balCardAmt, color: balances.owed > 0 ? C.teal : C.white }}>
              ₹{balances.owed.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* groups */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Groups</span>
            <button style={s.newBtn} onClick={() => navigate('/create-group')}>+ New</button>
          </div>

          {groups.length === 0 ? (
            <div style={{ ...s.emptyCard, ...glass }} onClick={() => navigate('/create-group')}>
              <p style={{ fontSize:'14px', color:C.gray1, textAlign:'center' }}>no groups yet — create one</p>
            </div>
          ) : (
            groups.map((group, i) => (
              <div key={group.id} style={{
                ...s.groupCard, ...glass,
                animation: `slideInUp 0.35s cubic-bezier(0.22,1,0.36,1) ${i*0.06}s both`,
              }}>
                <div style={s.groupAvatar}>{group.name[0].toUpperCase()}</div>
                <div style={{ flex:1, cursor:'pointer' }} onClick={() => navigate(`/group/${group.id}`)}>
                  <div style={s.groupName}>{group.name}</div>
                  <div style={s.groupSub}>tap to view expenses</div>
                </div>
                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                  <button style={s.inviteChip} onClick={e => shareInvite(group, e)}>invite</button>
                  {group.created_by === session.user.id && (
                    <button
                      style={{ ...s.deleteChip, opacity: deletingGroup === group.id ? 0.5 : 1 }}
                      onClick={e => { e.stopPropagation(); handleDeleteGroup(group) }}
                      disabled={deletingGroup === group.id}
                      title="Delete group"
                    >
                      {deletingGroup === group.id ? '…' : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* recent activity */}
        {recentExpenses.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Recent Activity</span>
            </div>
            <div style={{ ...glass, padding:'4px 0', overflow:'hidden', borderRadius:'20px' }}>
              {recentExpenses.map((exp, i) => {
                const iPaid = exp.paid_by === session.user.id
                return (
                  <div key={exp.id || i} style={{
                    ...s.actRow,
                    borderBottom: i < recentExpenses.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                  }}>
                    <div style={s.actIcon}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={s.actName}>{exp.description}</div>
                      <div style={s.actMeta}>{exp.groups?.name} · {new Date(exp.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                    </div>
                    <div style={{ ...s.actAmt, color: iPaid ? C.teal : C.red }}>
                      {iPaid ? '+' : '-'}₹{Number(exp.amount).toLocaleString('en-IN')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* bottom nav */}
      <div style={s.bottomNav}>
        <NavBtn icon={<HomeIcon />} label="Home" active />
        <NavBtn icon={<GroupIcon />} label="Friends" onClick={() => navigate('/friends')} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <button style={s.fab} onClick={() => groups.length > 0 ? navigate(`/add/${groups[0].id}`) : navigate('/create-group')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
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
    <button onClick={onClick} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', background:'none', border:'none', cursor:'pointer', color: active ? C.teal : '#555', fontSize:'10px', fontWeight: active ? '600':'400', padding:'4px 0' }}>
      <span style={{ color: active ? C.teal : '#555' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

const HomeIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
const GroupIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
const ScanIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
const SettleIcon= () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto', position:'relative', zIndex:1 },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', flexShrink:0, position:'relative', zIndex:2 },
  logoText:{ fontSize:'22px', fontWeight:'800', color:C.teal, letterSpacing:'-0.5px' },
  avatarBtn:{ width:'38px', height:'38px', borderRadius:'50%', background:'rgba(0,212,170,0.12)', backdropFilter:'blur(10px)', color:C.teal, fontWeight:'700', fontSize:'15px', border:'1px solid rgba(0,212,170,0.25)', cursor:'pointer' },
  scroll:{ flex:1, overflowY:'auto', padding:'8px 0', paddingBottom:'100px', position:'relative', zIndex:1 },
  balRow:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', padding:'8px 20px 16px' },
  balCard:{ borderRadius:'16px', padding:'16px' },
  balCardLabel:{ fontSize:'10px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', marginBottom:'8px' },
  balCardAmt:{ fontSize:'26px', fontWeight:'800', letterSpacing:'-0.5px' },
  section:{ padding:'0 20px', marginBottom:'16px' },
  sectionHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  sectionTitle:{ fontSize:'18px', fontWeight:'700', color:C.white },
  newBtn:{ fontSize:'13px', color:C.teal, background:'none', border:'none', cursor:'pointer', fontWeight:'600' },
  groupCard:{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', marginBottom:'10px', cursor:'default' },
  groupAvatar:{ width:'42px', height:'42px', borderRadius:'12px', background:'rgba(0,212,170,0.12)', backdropFilter:'blur(8px)', color:C.teal, fontSize:'18px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid rgba(0,212,170,0.2)' },
  groupName:{ fontSize:'15px', fontWeight:'600', color:C.white, marginBottom:'2px' },
  groupSub:{ fontSize:'11px', color:C.gray2 },
  inviteChip:{ fontSize:'11px', color:C.teal, background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.25)', borderRadius:'20px', padding:'5px 10px', cursor:'pointer', fontWeight:'600', backdropFilter:'blur(6px)', whiteSpace:'nowrap' },
  deleteChip:{ width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center', color:C.red, background:'rgba(255,77,77,0.1)', border:'1px solid rgba(255,77,77,0.25)', borderRadius:'50%', cursor:'pointer', backdropFilter:'blur(6px)', flexShrink:0 },
  emptyCard:{ padding:'24px', textAlign:'center', cursor:'pointer' },
  actRow:{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px' },
  actIcon:{ width:'34px', height:'34px', borderRadius:'10px', background:'rgba(0,212,170,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  actName:{ fontSize:'14px', fontWeight:'500', color:C.white, marginBottom:'2px' },
  actMeta:{ fontSize:'11px', color:C.gray2 },
  actAmt:{ fontSize:'15px', fontWeight:'700' },
  bottomNav:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:'rgba(22,22,22,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'flex-end', padding:'8px 0 14px', zIndex:100 },
  fab:{ width:'52px', height:'52px', borderRadius:'50%', background:C.teal, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px #00D4AA55', marginBottom:'-4px' },
  fabLabel:{ fontSize:'10px', color:C.teal, marginTop:'4px', fontWeight:'600' },
}