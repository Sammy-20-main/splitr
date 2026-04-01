import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCategoryById, CATEGORIES } from '../lib/categories'
import { C, glass } from '../theme'

export default function ExpenseDetail({ session }) {
  const { expenseId } = useParams()
  const navigate = useNavigate()

  const [expense, setExpense] = useState(null)
  const [splits, setSplits] = useState([])
  const [comments, setComments] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // edit state
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('other')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [expenseId])

  async function fetchAll() {
    const { data: exp } = await supabase
      .from('expenses')
      .select('*, profiles(id, name)')
      .eq('id', expenseId)
      .single()

    if (!exp) { navigate(-1); return }
    setExpense(exp)
    setEditDesc(exp.description)
    setEditAmount(String(exp.amount))
    setEditCategory(exp.category || 'other')

    const { data: sp } = await supabase
      .from('expense_splits')
      .select('*, profiles(id, name)')
      .eq('expense_id', expenseId)
    setSplits(sp || [])

    const { data: cm } = await supabase
      .from('comments')
      .select('*, profiles(id, name)')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true })
    setComments(cm || [])

    setLoading(false)
  }

  async function handleSave() {
    if (!editDesc.trim() || !editAmount) return
    setSaving(true)

    await supabase.from('expenses').update({
      description: editDesc.trim(),
      amount: parseFloat(editAmount),
      category: editCategory,
    }).eq('id', expenseId)

    // recalculate equal splits if amount changed
    if (parseFloat(editAmount) !== expense.amount && expense.split_type === 'equal') {
      const newShare = Math.round((parseFloat(editAmount) / splits.length) * 100) / 100
      for (const split of splits) {
        await supabase.from('expense_splits')
          .update({ amount: newShare })
          .eq('id', split.id)
      }
    }

    setEditing(false)
    setSaving(false)
    fetchAll()
  }

  async function handleDelete() {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    await supabase.from('comments').delete().eq('expense_id', expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    navigate(`/group/${expense.group_id}`)
  }

  async function postComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    await supabase.from('comments').insert({
      expense_id: expenseId,
      user_id: session.user.id,
      content: newComment.trim(),
    })
    setNewComment('')
    fetchAll()
    setPostingComment(false)
  }

  async function deleteComment(commentId) {
    await supabase.from('comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:C.bg }}>
      <p style={{ color:C.gray2 }}>loading...</p>
    </div>
  )

  const cat = getCategoryById(expense.category || 'other')
  const iPaid = expense.paid_by === session.user.id

  return (
    <div style={s.page}>
      {/* topbar */}
      <div style={s.topbar}>
        <button onClick={() => navigate(-1)} style={s.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style={s.title}>expense detail</span>
        <div style={{ display:'flex', gap:'8px' }}>
          {iPaid && !editing && (
            <button onClick={() => setEditing(true)} style={s.editBtn}>edit</button>
          )}
          {iPaid && (
            <button onClick={handleDelete} disabled={deleting} style={s.deleteBtn}>
              {deleting ? '...' : 'delete'}
            </button>
          )}
        </div>
      </div>

      <div style={s.scroll}>
        {/* expense header */}
        {!editing ? (
          <div style={{ ...s.headerCard, ...glass }} className="fadeUp">
            <div style={{ ...s.catIcon, background: cat.bg }}>
              <span style={{ fontSize:'28px' }}>{cat.icon}</span>
            </div>
            <div style={s.expDesc}>{expense.description}</div>
            <div style={s.expAmount}>₹{Number(expense.amount).toLocaleString('en-IN')}</div>
            <div style={s.expMeta}>
              paid by <span style={{ color: iPaid ? C.teal : C.white }}>{iPaid ? 'you' : expense.profiles?.name}</span>
              {' · '}{new Date(expense.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </div>
            <div style={{ ...s.catPill, background: cat.bg, color: cat.color }}>{cat.icon} {cat.label}</div>
          </div>
        ) : (
          /* edit form */
          <div style={{ ...s.editCard, ...glass }} className="fadeUp">
            <p style={s.sectionLabel}>editing expense</p>

            <label style={s.label}>description</label>
            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={s.input} />

            <label style={s.label}>amount (₹)</label>
            <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ ...s.input, fontSize:'24px', fontWeight:'700' }} inputMode="decimal" />

            <label style={s.label}>category</label>
            <div style={s.catGrid}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setEditCategory(c.id)}
                  style={{ ...s.catOption, background: editCategory === c.id ? c.bg : C.surface2, border: `1px solid ${editCategory === c.id ? c.color : C.border2}` }}>
                  <span style={{ fontSize:'20px' }}>{c.icon}</span>
                  <span style={{ fontSize:'10px', color: editCategory === c.id ? c.color : C.gray1, marginTop:'4px', textAlign:'center', lineHeight:'1.3' }}>{c.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
              <button onClick={() => setEditing(false)} style={s.cancelBtn}>cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'saving...' : 'save changes'}
              </button>
            </div>
          </div>
        )}

        {/* splits */}
        <div style={s.section}>
          <p style={s.sectionLabel}>split breakdown</p>
          <div style={{ ...s.card, ...glass }}>
            {splits.map((split, i) => {
              const isMe = split.user_id === session.user.id
              const isPayer = split.user_id === expense.paid_by
              return (
                <div key={split.id} style={{ ...s.splitRow, borderBottom: i < splits.length-1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={s.splitAvatar}>{split.profiles?.name?.[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={s.splitName}>{isMe ? `${split.profiles?.name} (you)` : split.profiles?.name}</div>
                    <div style={s.splitRole}>{isPayer ? 'paid the bill' : `owes ₹${Number(split.amount).toLocaleString('en-IN')}`}</div>
                  </div>
                  <div style={{ ...s.splitAmt, color: split.settled ? C.gray2 : isPayer ? C.teal : C.red }}>
                    {split.settled ? '✓ settled' : isPayer ? `+₹${Math.round(expense.amount - split.amount).toLocaleString('en-IN')}` : `-₹${Number(split.amount).toLocaleString('en-IN')}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* comments */}
        <div style={s.section}>
          <p style={s.sectionLabel}>comments ({comments.length})</p>

          {comments.length === 0 ? (
            <p style={s.noComments}>no comments yet — be the first!</p>
          ) : (
            <div style={s.commentsList}>
              {comments.map(cm => {
                const isMe = cm.user_id === session.user.id
                return (
                  <div key={cm.id} style={{ ...s.commentRow, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ ...s.commentAvatar, background: isMe ? '#00D4AA22' : C.surface2, color: isMe ? C.teal : C.gray1 }}>
                      {cm.profiles?.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ maxWidth:'75%' }}>
                      <div style={{ ...s.commentBubble, background: isMe ? '#00D4AA15' : C.surface, borderColor: isMe ? '#00D4AA33' : C.border }}>
                        <p style={s.commentText}>{cm.content}</p>
                      </div>
                      <div style={{ ...s.commentMeta, textAlign: isMe ? 'right' : 'left' }}>
                        {isMe ? 'you' : cm.profiles?.name} · {new Date(cm.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                        {isMe && (
                          <button onClick={() => deleteComment(cm.id)} style={s.deleteCommentBtn}>delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* comment input */}
          <div style={s.commentInput}>
            <input
              placeholder="add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
              style={s.commentBox}
            />
            <button onClick={postComment} disabled={postingComment || !newComment.trim()} style={{ ...s.sendBtn, opacity: (!newComment.trim() || postingComment) ? 0.4 : 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
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
  editBtn:{ fontSize:'12px', color:C.teal, background:'#00D4AA15', border:'1px solid #00D4AA44', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontWeight:'600' },
  deleteBtn:{ fontSize:'12px', color:C.red, background:'#FF4D4D15', border:'1px solid #FF4D4D44', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontWeight:'600' },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'40px' },
  headerCard:{ textAlign:'center', padding:'28px 24px 24px', borderBottom:`1px solid ${C.border}` },
  catIcon:{ width:'64px', height:'64px', borderRadius:'20px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' },
  expDesc:{ fontSize:'20px', fontWeight:'700', color:C.white, marginBottom:'8px' },
  expAmount:{ fontSize:'40px', fontWeight:'800', color:C.white, letterSpacing:'-1.5px', marginBottom:'8px' },
  expMeta:{ fontSize:'13px', color:C.gray1, marginBottom:'12px' },
  catPill:{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'12px', fontWeight:'600', padding:'5px 12px', borderRadius:'20px' },
  editCard:{ padding:'20px', borderBottom:`1px solid ${C.border}` },
  sectionLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'12px' },
  label:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'6px', marginTop:'14px' },
  input:{ width:'100%', padding:'13px 16px', fontSize:'16px', background:C.surface2, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', outline:'none' },
  catGrid:{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginTop:'8px' },
  catOption:{ display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 6px', borderRadius:'12px', cursor:'pointer', border:`1px solid ${C.border2}` },
  cancelBtn:{ flex:1, padding:'13px', background:C.surface2, color:C.gray1, border:`1px solid ${C.border2}`, borderRadius:'50px', fontSize:'14px', cursor:'pointer' },
  saveBtn:{ flex:2, padding:'13px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'14px', fontWeight:'700', cursor:'pointer' },
  section:{ padding:'20px' },
  card:{ background:C.surface, borderRadius:'16px', padding:'4px 16px', border:`1px solid ${C.border}` },
  splitRow:{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0' },
  splitAvatar:{ width:'36px', height:'36px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'14px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  splitName:{ fontSize:'14px', fontWeight:'500', color:C.white, marginBottom:'2px' },
  splitRole:{ fontSize:'12px', color:C.gray2 },
  splitAmt:{ fontSize:'14px', fontWeight:'700' },
  noComments:{ fontSize:'13px', color:C.gray2, textAlign:'center', padding:'16px 0' },
  commentsList:{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' },
  commentRow:{ display:'flex', gap:'8px', alignItems:'flex-end' },
  commentAvatar:{ width:'30px', height:'30px', borderRadius:'50%', fontSize:'12px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  commentBubble:{ padding:'10px 14px', borderRadius:'16px', border:'1px solid' },
  commentText:{ fontSize:'14px', color:C.white, lineHeight:'1.5' },
  commentMeta:{ fontSize:'10px', color:C.gray2, marginTop:'4px', display:'flex', alignItems:'center', gap:'6px' },
  deleteCommentBtn:{ fontSize:'10px', color:C.red, background:'none', border:'none', cursor:'pointer' },
  commentInput:{ display:'flex', gap:'8px', alignItems:'center' },
  commentBox:{ 
  ...glass,
  flex:1,
  padding:'12px 16px',
  fontSize:'14px',
  color:C.white,
  borderRadius:'50px',
  outline:'none'
},
  sendBtn:{ width:'42px', height:'42px', borderRadius:'50%', background:C.teal, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
}