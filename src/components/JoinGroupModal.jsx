import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function JoinGroupModal({ session, onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim()) return
    setLoading(true)

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .single()

    if (groupError || !group) {
      alert('Invalid invite code. Check it and try again.')
      setLoading(false)
      return
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', session.user.id)
      .single()

    if (existing) {
      alert("You're already in this group!")
      setLoading(false)
      onClose()
      return
    }

    const { error: joinError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: session.user.id })

    if (joinError) {
      alert(joinError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onJoined(group)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        <p style={s.title}>join a group</p>
        <p style={s.sub}>ask the group creator for their 6-letter invite code</p>

        <label style={s.label}>invite code</label>
        <input
          style={{ ...s.input, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '18px' }}
          type="text"
          placeholder="ABC123"
          value={code}
          maxLength={6}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          autoFocus
        />

        <button
          style={{ ...s.btn, opacity: loading || code.trim().length < 6 ? 0.5 : 1 }}
          disabled={loading || code.trim().length < 6}
          onClick={handleJoin}
        >
          {loading ? 'joining...' : 'join group'}
        </button>

        <button style={s.cancel} onClick={onClose}>cancel</button>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', zIndex: 200,
  },
  sheet: {
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '12px 24px 40px',
    width: '100%', maxWidth: '480px',
  },
  handle: {
    width: '36px', height: '4px',
    background: '#e0e0e0', borderRadius: '2px',
    margin: '0 auto 20px',
  },
  title: {
    fontSize: '17px', fontWeight: '600',
    marginBottom: '6px', color: '#1a1a1a',
  },
  sub: {
    fontSize: '13px', color: '#999',
    marginBottom: '20px', lineHeight: '1.5',
  },
  label: {
    fontSize: '12px', color: '#888',
    display: 'block', marginBottom: '6px',
  },
  input: {
    width: '100%', padding: '12px 14px',
    fontSize: '15px', border: '1px solid #e0e0e0',
    borderRadius: '10px', outline: 'none',
    marginBottom: '14px', fontFamily: 'inherit',
  },
  btn: {
    width: '100%', padding: '13px',
    background: '#1D9E75', color: '#fff',
    border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: '500',
    cursor: 'pointer', marginBottom: '10px',
  },
  cancel: {
    width: '100%', padding: '11px',
    background: 'none', color: '#999',
    border: 'none', fontSize: '14px',
    cursor: 'pointer',
  },
}