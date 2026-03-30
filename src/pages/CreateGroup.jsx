import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function CreateGroup({ session }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { data: group, error } = await supabase
      .from('groups').insert({ name: name.trim(), created_by: session.user.id })
      .select().single()
    if (error) { alert(error.message); setLoading(false); return }
    await supabase.from('group_members').insert({ group_id: group.id, user_id: session.user.id })
    navigate('/')
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button onClick={() => navigate('/')} style={s.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={s.title}>new group</span>
        <div style={{ width:'32px' }} />
      </div>

      <div style={s.body}>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>group name</label>
          <input type="text" placeholder="e.g. Goa Trip, Flat Expenses"
            value={name} onChange={e => setName(e.target.value)}
            autoFocus required style={s.input} />
          <div style={s.infoBox}>
            <p style={s.infoText}>invite friends after creating the group via a shareable link</p>
          </div>
          <button type="submit" disabled={loading || !name.trim()}
            style={{ ...s.btn, opacity:(!name.trim()||loading)?0.5:1 }}>
            {loading ? 'creating...' : 'create group'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto', display:'flex', flexDirection:'column' },
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${C.border}` },
  back: { background:'none', border:'none', cursor:'pointer', color:C.white, display:'flex', alignItems:'center' },
  title: { fontSize:'17px', fontWeight:'700', color:C.white },
  body: { padding:'24px 20px' },
  label: { fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'8px' },
  input: { width:'100%', padding:'14px 16px', fontSize:'16px', background:C.surface, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', outline:'none', marginBottom:'16px' },
  infoBox: { background:'#00D4AA15', border:'1px solid #00D4AA33', borderRadius:'12px', padding:'12px 16px', marginBottom:'20px' },
  infoText: { fontSize:'13px', color:C.teal },
  btn: { width:'100%', padding:'15px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'16px', fontWeight:'700', cursor:'pointer' },
}