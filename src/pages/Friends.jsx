import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function Friends({ session }) {
  const navigate = useNavigate()
  const [friends, setFriends] = useState([])
  const [pending, setPending] = useState([])  // requests I received
  const [sent, setSent] = useState([])         // requests I sent
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('friends')

  useEffect(() => { fetchFriends() }, [])

  async function fetchFriends() {
    // all friendships involving me
    const { data } = await supabase
      .from('friends')
      .select('*, requester:profiles!friends_user_id_fkey(id, name), receiver:profiles!friends_friend_id_fkey(id, name)')
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)

    if (!data) { setLoading(false); return }

    const acceptedFriends = []
    const pendingRequests = []
    const sentRequests = []

    data.forEach(f => {
      const iRequested = f.user_id === session.user.id
      const otherPerson = iRequested ? f.receiver : f.requester

      if (f.status === 'accepted') {
        acceptedFriends.push({ ...f, other: otherPerson })
      } else if (f.status === 'pending') {
        if (iRequested) sentRequests.push({ ...f, other: otherPerson })
        else pendingRequests.push({ ...f, other: otherPerson })
      }
    })

    setFriends(acceptedFriends)
    setPending(pendingRequests)
    setSent(sentRequests)
    setLoading(false)
  }

  async function sendFriendRequest() {
    if (!email.trim()) return
    setAdding(true)

    // find user by email
    const { data: users } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', (await supabase.from('profiles').select('id').limit(1)).data?.[0]?.id) // placeholder

    // correct approach — look up auth user by email via profiles
    // since we store profiles by auth.uid, we need to find by email
    // we'll use a workaround: search profiles by matching email in auth
    const { data: authUsers, error: authError } = await supabase
      .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
      .single()

    if (authError || !authUsers) {
      // fallback: just show not found
      alert('No user found with that email. Make sure they have a splitr account.')
      setAdding(false)
      return
    }

    const friendId = authUsers.id

    if (friendId === session.user.id) {
      alert("You can't add yourself!")
      setAdding(false)
      return
    }

    // check if already friends or pending
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`)
      .single()

    if (existing) {
      alert('Friend request already sent or already friends!')
      setAdding(false)
      return
    }

    const { error } = await supabase.from('friends').insert({
      user_id: session.user.id,
      friend_id: friendId,
      status: 'pending',
    })

    if (error) alert(error.message)
    else { setEmail(''); fetchFriends() }
    setAdding(false)
  }

  async function acceptRequest(friendshipId) {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendshipId)
    fetchFriends()
  }

  async function declineRequest(friendshipId) {
    await supabase.from('friends').delete().eq('id', friendshipId)
    fetchFriends()
  }

  async function removeFriend(friendshipId) {
    if (!window.confirm('Remove this friend?')) return
    await supabase.from('friends').delete().eq('id', friendshipId)
    fetchFriends()
  }

  const tabCount = { friends: friends.length, pending: pending.length, sent: sent.length }

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
        <span style={s.title}>friends</span>
        <div style={{ width:'32px' }} />
      </div>

      <div style={s.scroll}>
        {/* add friend */}
        <div style={s.addSection}>
          <p style={s.sectionLabel}>add a friend</p>
          <div style={s.addRow}>
            <input
              type="email"
              placeholder="their email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendFriendRequest()}
              style={s.addInput}
            />
            <button
              onClick={sendFriendRequest}
              disabled={adding || !email.trim()}
              style={{ ...s.addBtn, opacity: (!email.trim() || adding) ? 0.5 : 1 }}
            >
              {adding ? '...' : 'add'}
            </button>
          </div>
          <p style={s.addHint}>they need to have a splitr account first</p>
        </div>

        {/* pending banner */}
        {pending.length > 0 && (
          <div style={s.pendingBanner}>
            <span style={s.pendingDot} />
            <span style={s.pendingText}>{pending.length} pending friend request{pending.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* tabs */}
        <div style={s.tabs}>
          {['friends', 'pending', 'sent'].map(t => (
            <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
              {t} {tabCount[t] > 0 && <span style={s.tabBadge(tab === t)}>{tabCount[t]}</span>}
            </button>
          ))}
        </div>

        <div style={s.listSection}>
          {/* friends tab */}
          {tab === 'friends' && (
            friends.length === 0 ? (
              <div style={s.emptyCard}>
                <div style={s.emptyIcon}>👥</div>
                <p style={s.emptyTitle}>no friends yet</p>
                <p style={s.emptyText}>add friends by email above to split expenses outside of groups</p>
              </div>
            ) : (
              friends.map(f => (
                <div key={f.id} style={s.friendCard}>
                  <div style={s.friendAvatar}>{f.other?.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={s.friendName}>{f.other?.name}</div>
                    <div style={s.friendStatus}>friend</div>
                  </div>
                  <button style={s.removeBtn} onClick={() => removeFriend(f.id)}>remove</button>
                </div>
              ))
            )
          )}

          {/* pending tab */}
          {tab === 'pending' && (
            pending.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={s.emptyText}>no pending requests</p>
              </div>
            ) : (
              pending.map(f => (
                <div key={f.id} style={s.friendCard}>
                  <div style={s.friendAvatar}>{f.other?.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={s.friendName}>{f.other?.name}</div>
                    <div style={s.friendStatus}>wants to be friends</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button style={s.acceptBtn} onClick={() => acceptRequest(f.id)}>accept</button>
                    <button style={s.declineBtn} onClick={() => declineRequest(f.id)}>decline</button>
                  </div>
                </div>
              ))
            )
          )}

          {/* sent tab */}
          {tab === 'sent' && (
            sent.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={s.emptyText}>no sent requests</p>
              </div>
            ) : (
              sent.map(f => (
                <div key={f.id} style={s.friendCard}>
                  <div style={s.friendAvatar}>{f.other?.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={s.friendName}>{f.other?.name}</div>
                    <div style={s.friendStatus}>request sent · waiting</div>
                  </div>
                  <button style={s.removeBtn} onClick={() => declineRequest(f.id)}>cancel</button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  back:{ background:'none', border:'none', cursor:'pointer', color:C.white, display:'flex' },
  title:{ fontSize:'17px', fontWeight:'700', color:C.white },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'40px' },
  addSection:{ padding:'20px 20px 16px' },
  sectionLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'10px' },
  addRow:{ display:'flex', gap:'8px' },
  addInput:{ flex:1, padding:'13px 16px', fontSize:'15px', background:C.surface, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', outline:'none' },
  addBtn:{ padding:'13px 20px', background:C.teal, color:'#000', border:'none', borderRadius:'12px', fontSize:'14px', fontWeight:'700', cursor:'pointer' },
  addHint:{ fontSize:'12px', color:C.gray2, marginTop:'8px' },
  pendingBanner:{ display:'flex', alignItems:'center', gap:'8px', background:'#00D4AA15', border:`1px solid #00D4AA33`, margin:'0 20px 12px', borderRadius:'12px', padding:'10px 14px' },
  pendingDot:{ width:'8px', height:'8px', borderRadius:'50%', background:C.teal, flexShrink:0 },
  pendingText:{ fontSize:'13px', color:C.teal, fontWeight:'500' },
  tabs:{ display:'flex', background:C.surface, margin:'0 20px 16px', borderRadius:'12px', padding:'4px', gap:'4px' },
  tab:(active)=>({ flex:1, padding:'10px 0', fontSize:'13px', border:'none', borderRadius:'10px', background: active ? C.surface2 : 'transparent', color: active ? C.white : C.gray2, cursor:'pointer', fontWeight: active ? '600' : '400', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }),
  tabBadge:(active)=>({ fontSize:'10px', fontWeight:'700', background: active ? C.teal : C.gray2, color: active ? '#000' : C.bg, padding:'1px 5px', borderRadius:'10px' }),
  listSection:{ padding:'0 20px' },
  friendCard:{ display:'flex', alignItems:'center', gap:'12px', background:C.surface, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', border:`1px solid ${C.border}` },
  friendAvatar:{ width:'42px', height:'42px', borderRadius:'50%', background:'#00D4AA22', color:C.teal, fontSize:'17px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  friendName:{ fontSize:'15px', fontWeight:'600', color:C.white, marginBottom:'2px' },
  friendStatus:{ fontSize:'12px', color:C.gray2 },
  removeBtn:{ fontSize:'12px', color:C.red, background:'#FF4D4D15', border:'1px solid #FF4D4D33', borderRadius:'20px', padding:'5px 10px', cursor:'pointer' },
  acceptBtn:{ fontSize:'12px', color:'#000', background:C.teal, border:'none', borderRadius:'20px', padding:'6px 12px', cursor:'pointer', fontWeight:'700' },
  declineBtn:{ fontSize:'12px', color:C.red, background:'#FF4D4D15', border:'1px solid #FF4D4D33', borderRadius:'20px', padding:'5px 10px', cursor:'pointer' },
  emptyCard:{ background:C.surface, borderRadius:'16px', padding:'32px 20px', textAlign:'center', border:`1.5px dashed ${C.border2}` },
  emptyIcon:{ fontSize:'36px', marginBottom:'12px' },
  emptyTitle:{ fontSize:'16px', fontWeight:'700', color:C.white, marginBottom:'6px' },
  emptyText:{ fontSize:'13px', color:C.gray2, lineHeight:'1.6' },
}