import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function SetupProfile({ session }) {
  const [name, setName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase.from('profiles')
      .upsert({ id: session.user.id, name: name.trim(), upi_id: upiId.trim() || null })
    if (error) alert(error.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.top}>
        <div style={s.logo}>splitr</div>
        <p style={s.sub}>set up your profile</p>
      </div>
      <form onSubmit={handleSubmit} className="fadeUp">
        <div style={s.group}>
          <label style={s.label}>your name</label>
          <input type="text" placeholder="Arjun" value={name}
            onChange={e => setName(e.target.value)} required style={s.input} autoFocus />
        </div>
        <div style={s.group}>
          <label style={s.label}>UPI ID <span style={{ color:C.gray2, textTransform:'none' }}>(optional)</span></label>
          <input type="text" placeholder="arjun@okaxis" value={upiId}
            onChange={e => setUpiId(e.target.value)} style={s.input} />
          <p style={s.hint}>needed for one-tap payments on settle up</p>
        </div>
        <button type="submit" disabled={loading || !name.trim()}
          style={{ ...s.btn, opacity: (!name.trim() || loading) ? 0.5 : 1 }}>
          {loading ? 'saving...' : 'get started →'}
        </button>
      </form>
    </div>
  )
}

const s = {
  page: { minHeight:'100dvh', background:C.bg, display:'flex', flexDirection:'column', justifyContent:'center', padding:'40px 24px' },
  top: { marginBottom:'36px' },
  logo: { fontSize:'36px', fontWeight:'800', color:C.teal, letterSpacing:'-1.5px', marginBottom:'6px' },
  sub: { fontSize:'15px', color:C.gray1 },
  group: { marginBottom:'20px' },
  label: { fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'8px' },
  input: { width:'100%', padding:'14px 16px', fontSize:'16px', background:C.surface, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', outline:'none' },
  hint: { fontSize:'12px', color:C.gray2, marginTop:'6px' },
  btn: { width:'100%', padding:'15px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'16px', fontWeight:'700', cursor:'pointer', marginTop:'8px' },
}