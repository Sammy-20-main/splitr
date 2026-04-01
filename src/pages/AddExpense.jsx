import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES, getCategoryById } from '../lib/categories'
import { C, glass } from '../theme'


export default function AddExpense({ session }) {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill || null

  const [members, setMembers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState(prefill?.description || '')
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '')
  const [paidBy, setPaidBy] = useState(session.user.id)
  const [splitType, setSplitType] = useState('equal')
  const [category, setCategory] = useState(prefill?.category || 'food')
  const [customSplits, setCustomSplits] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)

  useEffect(() => { fetchMembers() }, [groupId])

  async function fetchMembers() {
    const { data: grp } = await supabase.from('groups').select('name').eq('id', groupId).single()
    setGroupName(grp?.name || '')
    const { data } = await supabase.from('group_members').select('user_id, profiles(id, name, upi_id)').eq('group_id', groupId)
    const mems = data?.map(d => d.profiles).filter(Boolean) || []
    setMembers(mems)
    const init = {}
    mems.forEach(m => { init[m.id] = '' })
    setCustomSplits(init)
    setLoadingMembers(false)
  }

  function getSplits() {
    const total = parseFloat(amount) || 0
    if (total === 0 || members.length === 0) return []
    if (splitType === 'equal') {
      const share = Math.round((total / members.length) * 100) / 100
      return members.map(m => ({ ...m, share }))
    }
    if (splitType === 'percent') {
      return members.map(m => {
        const pct = parseFloat(customSplits[m.id]) || 0
        return { ...m, share: Math.round((total * pct / 100) * 100) / 100 }
      })
    }
    if (splitType === 'exact') {
      return members.map(m => ({ ...m, share: Math.round((parseFloat(customSplits[m.id]) || 0) * 100) / 100 }))
    }
    return []
  }

  function totalCustom() {
    return Object.values(customSplits).reduce((a, v) => a + (parseFloat(v) || 0), 0)
  }

  function isValid() {
    if (!description.trim() || !amount || parseFloat(amount) <= 0) return false
    if (splitType === 'percent') return Math.abs(totalCustom() - 100) < 0.01
    if (splitType === 'exact') return Math.abs(totalCustom() - parseFloat(amount)) < 0.01
    return true
  }

  async function handleSave() {
    if (!isValid()) return
    setLoading(true)
    const splits = getSplits()
    const totalAmt = parseFloat(amount)
    const { data: expense, error } = await supabase.from('expenses')
      .insert({ group_id: groupId, description: description.trim(), amount: totalAmt, paid_by: paidBy, split_type: splitType, category })
      .select().single()
    if (error) { alert(error.message); setLoading(false); return }
    await supabase.from('expense_splits').insert(splits.map(m => ({ expense_id: expense.id, user_id: m.id, amount: m.share, settled: false })))
    navigate(`/group/${groupId}`)
    setLoading(false)
  }

  const splits = getSplits()
  const total = parseFloat(amount) || 0
  const paidByMember = members.find(m => m.id === paidBy)
  const selectedCat = getCategoryById(category)

  if (loadingMembers) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:C.bg }}>
      <p style={{ color:C.gray2 }}>loading...</p>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button onClick={() => navigate(`/group/${groupId}`)} style={s.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={s.pageTitle}>splitr</div>
          <div style={s.pageSubtitle}>{groupName.toUpperCase()}</div>
        </div>
        <button style={s.scanBtn} onClick={() => navigate('/scan', { state:{ groupId } })}>scan</button>
      </div>

      {prefill && <div style={s.prefillBanner}>receipt pre-filled — review and confirm</div>}

      <div style={s.scroll}>
        {/* amount */}
        <div style={s.amountSection}>
          <p style={s.amountLabel}>Amount spent</p>
          <div style={s.amountRow}>
            <span style={s.rupeeSign}>₹</span>
            <input type="number" placeholder="0" value={amount}
              onChange={e => setAmount(e.target.value)}
              style={s.amountInput} inputMode="decimal" />
          </div>
        </div>

        <div style={s.body}>
          {/* description */}
          <input type="text" placeholder="What was this for?"
            value={description} onChange={e => setDescription(e.target.value)}
            style={s.descInput} />

          {/* category picker */}
          <div style={{ ...s.fieldCard, ...glass }}>
            <p style={s.fieldLabel}>CATEGORY</p>
            <div style={s.catGrid}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)}
                  style={{ ...s.catOption, background: category === cat.id ? cat.bg : C.surface2, border:`1px solid ${category === cat.id ? cat.color : C.border2}` }}>
                  <span style={{ fontSize:'22px' }}>{cat.icon}</span>
                  <span style={{ fontSize:'10px', color: category === cat.id ? cat.color : C.gray2, marginTop:'4px', textAlign:'center', lineHeight:'1.3' }}>
                    {cat.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* paid by */}
          <div style={{ ...s.fieldCard, ...glass }}>
            <div style={s.fieldHeader}>
              <span style={s.fieldLabel}>PAID BY</span>
              <button style={s.changeBtn} onClick={() => {
                const idx = members.findIndex(m => m.id === paidBy)
                const next = members[(idx + 1) % members.length]
                if (next) setPaidBy(next.id)
              }}>CHANGE</button>
            </div>
            <div style={s.paidByRow}>
              <div style={s.paidByAvatar}>{(paidByMember?.name || '?')[0].toUpperCase()}</div>
              <div>
                <div style={s.paidByName}>{paidByMember?.id === session.user.id ? `${paidByMember?.name} (you)` : paidByMember?.name}</div>
                <div style={s.paidByRole}>Primary Payer</div>
              </div>
            </div>
          </div>

          {/* split method */}
          <div style={{ ...s.fieldCard, ...glass }}>
            <p style={s.fieldLabel}>SPLIT METHOD</p>
            <div style={s.splitTabs}>
              {['equal','percent','exact'].map(type => (
                <button key={type} onClick={() => setSplitType(type)}
                  style={{ ...s.splitTab, ...(splitType === type ? s.splitTabActive : {}) }}>
                  {type === 'equal' ? 'Equal' : type === 'percent' ? 'By %' : 'Exact'}
                </button>
              ))}
            </div>
          </div>

          {/* custom split inputs */}
          {splitType !== 'equal' && (
            <div style={{ ...s.fieldCard, ...glass }}>
              <p style={s.fieldLabel}>
                {splitType === 'percent' ? `PERCENTAGES (${totalCustom().toFixed(0)}% / 100%)` : `AMOUNTS (₹${totalCustom().toFixed(0)} / ₹${total.toFixed(0)})`}
              </p>
              {members.map(m => (
                <div key={m.id} style={s.customRow}>
                  <div style={s.customAvatar}>{m.name?.[0]?.toUpperCase()}</div>
                  <span style={s.customName}>{m.id === session.user.id ? `${m.name} (you)` : m.name}</span>
                  <input type="number" placeholder="0" value={customSplits[m.id]}
                    onChange={e => setCustomSplits(prev => ({ ...prev, [m.id]: e.target.value }))}
                    style={s.customInput} inputMode="decimal" />
                  <span style={{ fontSize:'12px', color:C.gray2 }}>{splitType === 'percent' ? '%' : '₹'}</span>
                </div>
              ))}
            </div>
          )}

          {/* split summary */}
          {total > 0 && (
            <div style={s.fieldCard}>
              <div style={s.summaryHeader}>
                <span style={s.fieldLabel}>SPLIT SUMMARY</span>
                <span style={s.peopleBadge}>{members.length} PEOPLE</span>
              </div>
              {splits.map(m => {
                const isPayer = m.id === paidBy
                return (
                  <div key={m.id} style={s.summaryRow}>
                    <div style={s.summaryAvatar}>{m.name?.[0]?.toUpperCase()}</div>
                    <span style={s.summaryName}>{m.name}</span>
                    <div style={{ textAlign:'right' }}>
                      <div style={s.summaryRole}>{isPayer ? 'OWES YOU' : 'YOU OWE'}</div>
                      <div style={{ fontSize:'18px', fontWeight:'700', color: isPayer ? C.teal : C.red }}>
                        {isPayer ? '+' : '-'}₹{m.share.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={s.footer}>
        {splitType === 'percent' && Math.abs(totalCustom()-100) > 0.01 && totalCustom() > 0 && (
          <p style={s.warning}>must total 100% (currently {totalCustom().toFixed(1)}%)</p>
        )}
        {splitType === 'exact' && total > 0 && Math.abs(totalCustom()-total) > 0.01 && totalCustom() > 0 && (
          <p style={s.warning}>must total ₹{total.toFixed(2)} (currently ₹{totalCustom().toFixed(2)})</p>
        )}
        <button onClick={handleSave} disabled={!isValid() || loading}
          style={{ ...s.saveBtn, opacity:(!isValid()||loading)?0.4:1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          {loading ? 'SAVING...' : 'SAVE EXPENSE'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  back:{ background:'none', border:'none', cursor:'pointer', color:C.white, display:'flex' },
  pageTitle:{ fontSize:'16px', fontWeight:'800', color:C.teal, letterSpacing:'-0.5px' },
  pageSubtitle:{ fontSize:'10px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em' },
  scanBtn:{ fontSize:'12px', color:C.teal, background:'#00D4AA15', border:'1px solid #00D4AA44', borderRadius:'20px', padding:'6px 12px', cursor:'pointer', fontWeight:'600' },
  prefillBanner:{ background:'#00D4AA15', padding:'10px 20px', fontSize:'12px', color:C.teal, fontWeight:'500', textAlign:'center' },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'160px' },
  amountSection:{ padding:'24px 24px 16px', borderBottom:`1px solid ${C.border}` },
  amountLabel:{ fontSize:'13px', color:C.gray1, marginBottom:'8px' },
  amountRow:{ display:'flex', alignItems:'center', gap:'8px' },
  rupeeSign:{ fontSize:'28px', fontWeight:'700', color:C.teal },
  amountInput:{ fontSize:'52px', fontWeight:'800', border:'none', outline:'none', background:'transparent', color:C.white, width:'100%', letterSpacing:'-2px' },
  body:{ padding:'16px 20px' },
  descInput:{ width:'100%', padding:'16px', fontSize:'16px', background:C.surface, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'14px', outline:'none', marginBottom:'12px', textAlign:'center' },
  fieldCard:{ background:C.surface, borderRadius:'16px', padding:'16px', marginBottom:'12px', border:`1px solid ${C.border}` },
  fieldHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  fieldLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase' },
  changeBtn:{ fontSize:'12px', color:C.teal, background:'none', border:'none', cursor:'pointer', fontWeight:'700' },
  catGrid:{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginTop:'8px' },
  catOption:{ display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 4px', borderRadius:'12px', cursor:'pointer' },
  paidByRow:{ display:'flex', alignItems:'center', gap:'12px' },
  paidByAvatar:{ width:'40px', height:'40px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'16px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' },
  paidByName:{ fontSize:'15px', fontWeight:'600', color:C.white },
  paidByRole:{ fontSize:'11px', color:C.gray2 },
  splitTabs:{ display:'flex', background:C.surface2, borderRadius:'12px', padding:'4px', gap:'4px' },
  splitTab:{ flex:1, padding:'10px 0', fontSize:'14px', border:'none', borderRadius:'10px', background:'transparent', color:C.gray1, cursor:'pointer', fontWeight:'500' },
  splitTabActive:{ background:C.teal, color:'#000', fontWeight:'700' },
  customRow:{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' },
  customAvatar:{ width:'32px', height:'32px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'12px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  customName:{ flex:1, fontSize:'14px', color:C.white },
  customInput:{ width:'72px', padding:'8px 10px', fontSize:'14px', background:C.surface2, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'8px', outline:'none', textAlign:'right' },
  summaryHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' },
  peopleBadge:{ fontSize:'10px', fontWeight:'700', background:C.surface2, color:C.gray1, padding:'4px 10px', borderRadius:'20px', letterSpacing:'0.06em' },
  summaryRow:{ display:'flex', alignItems:'center', gap:'12px', paddingBottom:'12px', marginBottom:'12px', borderBottom:`1px solid ${C.border}` },
  summaryAvatar:{ width:'38px', height:'38px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'15px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  summaryName:{ flex:1, fontSize:'15px', fontWeight:'500', color:C.white },
  summaryRole:{ fontSize:'10px', fontWeight:'600', color:C.gray2, letterSpacing:'0.06em', marginBottom:'2px' },
  footer:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:C.bg, padding:'12px 20px 20px', borderTop:`1px solid ${C.border}` },
  warning:{ fontSize:'11px', color:C.red, textAlign:'center', marginBottom:'8px' },
  saveBtn:{ width:'100%', padding:'16px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'14px', fontWeight:'800', cursor:'pointer', letterSpacing:'0.06em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
}