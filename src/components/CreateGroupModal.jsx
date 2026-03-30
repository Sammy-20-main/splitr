import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateInviteCode } from '../utils/generateInviteCode'

export default function CreateGroupModal({ session, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)

    const invite_code = generateInviteCode()

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: name.trim(), invite_code, created_by: session.user.id })
      .select()
      .single()

    if (groupError) {
      alert(groupError.message)
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: session.user.id })

    if (memberError) {
      alert(memberError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onCreated(group)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        <p style={s.title}>new group</p>

        <label style={s.label}>group name</label>
        <input
          style={s.input}
          type="text"
          placeholder="weekend trip, flat expenses..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          autoFocus
        />

        <button
          style={{ ...s.btn, opacity: loading || !name.trim() ? 0.5 : 1 }}
          disabled={loading || !name.trim()}
          onClick={handleCreate}
        >
          {loading ? 'creating...' : 'create group'}
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
    marginBottom: '20px', color: '#1a1a1a',
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