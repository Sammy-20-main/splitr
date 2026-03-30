import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function JoinGroup({ session }) {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => { fetchGroup() }, [inviteCode])

  async function fetchGroup() {
    const { data, error } = await supabase.from('groups').select('*').eq('invite_code', inviteCode).single()
    if (error || !data) { setStatus('error'); return }
    const { data: existing } = await supabase.from('group_members').select('group_id').eq('group_id', data.id).eq('user_id', session.user.id).single()
    setGroup(data)
    setStatus(existing ? 'already' : 'found')
  }

  async function joinGroup() {
    setStatus('loading')
    const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: session.user.id })
    if (error) setStatus('error')
    else navigate(`/group/${group.id}`)
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="fadeUp">
        {status === 'loading' && <p style={s.muted}>looking up invite...</p>}
        {status === 'error' && (
          <>
            <div style={s.icon}>?</div>
            <p style={s.title}>invite not found</p>
            <p style={s.sub}>this link may be invalid or expired</p>
            <button style={s.btn} onClick={() => navigate('/')}>go home</button>
          </>
        )}
        {status === 'already' && (
          <>
            <div style={{ ...s.icon, background:'#00D4AA22', color:'#00D4AA' }}>✓</div>
            <p style={s.title}>already a member</p>
            <p style={s.sub}>you're already in <strong style={{ color:C.white }}>{group?.name}</strong></p>
            <button style={s.btn} onClick={() => navigate(`/group/${group.id}`)}>go to group</button>
          </>
        )}
        {status === 'found' && (
          <>
            <div style={{ ...s.icon, fontSize:'28px' }}>👥</div>
            <p style={s.title}>you're invited!</p>
            <p style={s.sub}>join <strong style={{ color:C.white }}>{group?.name}</strong> on splitr</p>
            <button style={s.btn} onClick={joinGroup}>join group</button>
            <button style={s.ghost} onClick={() => navigate('/')}>not now</button>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' },
  card: { background:C.surface, borderRadius:'24px', padding:'36px 24px', border:`1px solid ${C.border}`, textAlign:'center', width:'100%' },
  icon: { width:'60px', height:'60px', borderRadius:'50%', background:C.surface2, color:C.gray1, fontSize:'24px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' },
  title: { fontSize:'20px', fontWeight:'700', color:C.white, marginBottom:'8px' },
  sub: { fontSize:'14px', color:C.gray1, marginBottom:'24px', lineHeight:'1.6' },
  muted: { fontSize:'14px', color:C.gray2 },
  btn: { width:'100%', padding:'14px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'15px', fontWeight:'700', cursor:'pointer', marginBottom:'10px' },
  ghost: { width:'100%', padding:'12px', background:'none', color:C.gray2, border:'none', fontSize:'14px', cursor:'pointer' },
}