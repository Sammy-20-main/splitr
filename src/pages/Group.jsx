import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculateBalances } from '../lib/simplifyDebts'
import { getCategoryById, CATEGORIES } from '../lib/categories'
import { C, glass } from '../theme'

export default function Group({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const { data: grp } = await supabase.from('groups').select('*').eq('id', id).single()
    setGroup(grp)
    const { data: mems } = await supabase.from('group_members').select('user_id, profiles(id, name)').eq('group_id', id)
    setMembers(mems?.map(m => m.profiles).filter(Boolean) || [])
    const { data: exps } = await supabase.from('expenses')
      .select('*, profiles(name), expense_splits(user_id, amount, settled)')
      .eq('group_id', id).order('created_at', { ascending: false })
    setExpenses(exps || [])
    if (exps) setBalances(calculateBalances(exps, session.user.id))
    setLoading(false)
  }

  function shareInvite() {
    if (!group) return
    const url = `${window.location.origin}/join/${group.invite_code}`
    if (navigator.share) navigator.share({ title: `Join ${group.name} on splitr`, url })
    else { navigator.clipboard.writeText(url); alert('Invite link copied!') }
  }

  const filteredExpenses = filterCat === 'all'
    ? expenses
    : expenses.filter(e => (e.category || 'other') === filterCat)

  // categories that actually exist in this group's expenses
  const usedCategories = ['all', ...new Set(expenses.map(e => e.category || 'other'))]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:C.bg }}>
      <p style={{ color:C.gray2 }}>loading...</p>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button onClick={() => navigate('/')} style={s.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={s.groupTitle}>{group?.name}</div>
          <div style={s.groupSub}>{members.length} members</div>
        </div>
        <button style={s.inviteBtn} onClick={shareInvite}>invite</button>
      </div>

      <div style={s.scroll}>
        {/* members */}
        <div style={s.membersRow}>
          {members.map(m => (
            <div key={m.id} style={s.memberChip}>
              <div style={s.memberAvatar}>{m.name?.[0]?.toUpperCase()}</div>
              <span style={s.memberName}>{m.name?.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* balances */}
        {balances.length > 0 && (
          <div style={{ padding:'0 20px', marginBottom:'16px' }}>
            <div style={s.sectionLabel}>Balances</div>
            <div style={{ ...s.balCard, ...glass }}>
              {balances.map((b, i) => (
                <div key={i} style={{ ...s.balRow, borderBottom: i < balances.length-1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={s.balName}>{b.name}</span>
                  <span style={{ fontSize:'15px', fontWeight:'700', color: b.amount > 0 ? C.teal : C.red }}>
                    {b.amount > 0 ? '+' : ''}₹{Math.abs(b.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              <button style={s.settleBtn} onClick={() => navigate(`/settle/${id}`)}>settle up →</button>
            </div>
          </div>
        )}

        {/* category filter */}
        {expenses.length > 0 && (
          <div style={s.filterRow}>
            {usedCategories.map(catId => {
              const cat = catId === 'all' ? { icon:'', label:'All', color: C.teal, bg:'#00D4AA22' } : getCategoryById(catId)
              return (
                <button key={catId} onClick={() => setFilterCat(catId)}
                  style={{ ...s.filterChip, background: filterCat === catId ? cat.bg : C.surface, color: filterCat === catId ? cat.color : C.gray2, border:`1px solid ${filterCat === catId ? cat.color+'66' : C.border}` }}>
                  {catId !== 'all' && cat.icon + ' '}{cat.label}
                </button>
              )
            })}
          </div>
        )}

        {/* expenses */}
        <div style={{ padding:'0 20px' }}>
          <div style={s.sectionLabel}>
            {filterCat === 'all' ? 'All expenses' : getCategoryById(filterCat).label}
            {' '}({filteredExpenses.length})
          </div>

          {filteredExpenses.length === 0 ? (
            <div style={{ ...s.emptyCard, ...glass }}>
              <p style={{ fontSize:'14px', color:C.gray2, textAlign:'center' }}>
                {filterCat === 'all' ? 'no expenses yet — add the first one!' : `no ${getCategoryById(filterCat).label} expenses`}
              </p>
            </div>
          ) : (
            filteredExpenses.map(exp => {
              const myShare = exp.expense_splits?.find(sp => sp.user_id === session.user.id)
              const iPaid = exp.paid_by === session.user.id
              const cat = getCategoryById(exp.category || 'other')
              return (
                <div key={exp.id} style={{ ...s.expCard, ...glass }}
                  onClick={() => navigate(`/expense/${exp.id}`)}>
                  <div style={{ ...s.expIconWrap, background: cat.bg }}>
                    <span style={{ fontSize:'18px' }}>{cat.icon}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={s.expName}>{exp.description}</div>
                    <div style={s.expMeta}>
                      {iPaid ? 'you paid' : `${exp.profiles?.name} paid`} · {new Date(exp.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={s.expTotal}>₹{Number(exp.amount).toLocaleString('en-IN')}</div>
                    {myShare && (
                      <div style={{ fontSize:'11px', fontWeight:'600', color: iPaid ? C.teal : C.red }}>
                        {iPaid ? `lent ₹${Math.round(exp.amount - myShare.amount).toLocaleString('en-IN')}` : `owe ₹${Math.round(myShare.amount).toLocaleString('en-IN')}`}
                      </div>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray2} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              )
            })
          )}
        </div>
      </div>

      <button style={s.fab} onClick={() => navigate(`/add/${id}`)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>
  )
}

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  back:{ background:'none', border:'none', cursor:'pointer', color:C.white, display:'flex' },
  groupTitle:{ fontSize:'17px', fontWeight:'700', color:C.white },
  groupSub:{ fontSize:'11px', color:C.gray2, marginTop:'1px' },
  inviteBtn:{ fontSize:'12px', color:C.teal, background:'#00D4AA15', border:'1px solid #00D4AA44', borderRadius:'20px', padding:'6px 12px', cursor:'pointer', fontWeight:'600' },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'100px' },
  membersRow:{ display:'flex', gap:'16px', padding:'16px 20px', overflowX:'auto' },
  memberChip:{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', flexShrink:0 },
  memberAvatar:{ width:'44px', height:'44px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'18px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.border2}` },
  memberName:{ fontSize:'11px', color:C.gray1 },
  sectionLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'10px' },
  balCard:{ background:C.surface, borderRadius:'16px', padding:'4px 16px', border:`1px solid ${C.border}` },
  balRow:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0' },
  balName:{ fontSize:'14px', color:C.white },
  settleBtn:{ width:'100%', padding:'12px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'14px', fontWeight:'700', cursor:'pointer', marginTop:'8px', marginBottom:'8px' },
  filterRow:{ display:'flex', gap:'8px', padding:'0 20px 16px', overflowX:'auto' },
  filterChip:{ padding:'6px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  expCard:{ display:'flex', alignItems:'center', gap:'12px', background:C.surface, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', border:`1px solid ${C.border}`, cursor:'pointer' },
  expIconWrap:{ width:'40px', height:'40px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  expName:{ fontSize:'14px', fontWeight:'600', color:C.white, marginBottom:'3px' },
  expMeta:{ fontSize:'11px', color:C.gray2 },
  expTotal:{ fontSize:'14px', fontWeight:'700', color:C.white, marginBottom:'3px' },
  emptyCard:{ background:C.surface, borderRadius:'14px', padding:'28px', border:`1.5px dashed ${C.border2}` },
  fab:{ position:'fixed', bottom:'30px', right:'20px', width:'54px', height:'54px', borderRadius:'50%', background:C.teal, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px #00D4AA55' },
}


