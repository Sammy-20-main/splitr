import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { getGroupNetBalances, simplifyDebts } from '../lib/simplifyDebts'
import { C, glass } from '../theme'

// ── animated number counter ───────────────────────────────────────────────────
function CountTo({ from, to, duration = 900, prefix = '₹' }) {
  const [val, setVal] = useState(from)
  const raf = useRef(null)

  useEffect(() => {
    const start   = performance.now()
    const diff    = to - from

    function tick(now) {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(from + diff * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [from, to, duration])

  return <span>{prefix}{val.toLocaleString('en-IN')}</span>
}

// ── confetti burst on settle ──────────────────────────────────────────────────
function SettleConfetti({ trigger }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx    = canvas.getContext('2d')
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    let animId
    let particles = []

    const cx = canvas.width / 2
    const cy = canvas.height / 2

    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.3
      const speed = 2 + Math.random() * 5
      const colors = ['#00D4AA','#00FFD1','#ffffff','#5FFFDA','#00B894','#FFD700']
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.018 + Math.random() * 0.012,
        gravity: 0.1,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      })
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles = particles.filter(p => p.alpha > 0.01)
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle   = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size)
        }
        ctx.restore()
        p.x += p.vx
        p.y += p.vy
        p.vy += p.gravity
        p.vx *= 0.97
        p.alpha    -= p.decay
        p.rotation += p.spin
      }
      if (particles.length > 0) animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 999,
      }}
    />
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function SettleUp({ session }) {
  const { groupId }  = useParams()
  const navigate     = useNavigate()

  const [transactions, setTransactions] = useState([])
  const [settled,      setSettled]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [settling,     setSettling]     = useState(null)
  const [groupName,    setGroupName]    = useState('')
  const [openQR,       setOpenQR]       = useState(null)
  const [activeTab,    setActiveTab]    = useState('pending')

  // animation state
  const [confettiKey,   setConfettiKey]   = useState(0)
  const [showAllClear,  setShowAllClear]  = useState(false)
  const [poppingCard,   setPoppingCard]   = useState(null) // key being popped

  useEffect(() => { fetchData() }, [groupId])

  async function fetchData() {
    const { data: grp } = await supabase
      .from('groups').select('name').eq('id', groupId).single()
    setGroupName(grp?.name || '')

    const { data: expenses } = await supabase
      .from('expenses')
      .select('*, profiles(name), expense_splits(id, user_id, amount, settled)')
      .eq('group_id', groupId)

    if (!expenses) { setLoading(false); return }

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, name, upi_id)')
      .eq('group_id', groupId)

    const profileMap = {}
    members?.forEach(m => { if (m.profiles) profileMap[m.profiles.id] = m.profiles })

    const balances = getGroupNetBalances(expenses)
    const enriched = balances.map(b => ({
      ...b,
      name:  profileMap[b.userId]?.name  || b.name,
      upiId: profileMap[b.userId]?.upi_id || null,
      isMe:  b.userId === session.user.id,
    }))

    setTransactions(simplifyDebts(enriched))
    setLoading(false)
  }

  async function markSettled(txn) {
    const key = txn.from.userId + txn.to.userId
    setSettling(key)
    setPoppingCard(key)

    const { data: splits } = await supabase
      .from('expense_splits')
      .select('id, expense_id, expenses(paid_by)')
      .eq('user_id', txn.from.userId)
      .eq('settled', false)

    const ids = splits
      ?.filter(s => s.expenses?.paid_by === txn.to.userId)
      .map(s => s.id) || []

    if (ids.length > 0) {
      await supabase.from('expense_splits').update({ settled: true }).in('id', ids)
    }

    // wait for pop animation then remove card
    setTimeout(() => {
      setSettled(prev => {
        const next = [...prev, key]
        // check if all done
        const pending = transactions.filter(t => !next.includes(t.from.userId + t.to.userId))
        if (pending.length === 0) {
          setTimeout(() => {
            setShowAllClear(true)
            setConfettiKey(k => k + 1)
          }, 200)
        }
        return next
      })
      setPoppingCard(null)
      setSettling(null)
    }, 420)

    fetchData()
  }

  function getUPILink(txn) {
    if (!txn.to.upiId) return null
    return `upi://pay?pa=${txn.to.upiId}&pn=${encodeURIComponent(txn.to.name)}&am=${txn.amount}&tn=splitr&cu=INR`
  }

  const pending     = transactions.filter(t => !settled.includes(t.from.userId + t.to.userId))
  const settledTxns = transactions.filter(t =>  settled.includes(t.from.userId + t.to.userId))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:C.bg }}>
      <p style={{ color:C.gray2 }}>calculating...</p>
    </div>
  )

  return (
    <div style={s.page}>
      {/* confetti canvas — renders on top of everything */}
      <SettleConfetti trigger={confettiKey} />

      <div style={s.topbar}>
        <button style={s.menuBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>
        <span style={s.logoText}>splitr</span>
        <button onClick={() => navigate('/')} style={s.avatarBtn}>←</button>
      </div>

      <div style={s.scroll}>
        <div style={{ padding:'20px 20px 16px' }}>
          <h1 style={s.pageTitle}>settle up</h1>
          {pending.length > 0 && (
            <div style={s.activeBadge}>
              <span style={s.activeDot} />
              {pending.length} ACTIVE DEBT{pending.length > 1 ? 'S' : ''}
            </div>
          )}
        </div>

        {/* tabs */}
        <div style={s.tabs}>
          <button style={s.tab(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>pending</button>
          <button style={s.tab(activeTab === 'history')} onClick={() => setActiveTab('history')}>history</button>
        </div>

        <div style={{ padding:'16px 20px' }}>
          {activeTab === 'pending' && (
            <>
              {/* all clear screen */}
              {(pending.length === 0 || showAllClear) ? (
                <div style={{
                  ...s.allClearCard,
                  animation: showAllClear ? 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
                }}>
                  <div style={s.allClearIconWrap}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                  <p style={s.allClearTitle}>all settled up!</p>
                  <p style={s.allClearSub}>no pending payments in this group</p>
                </div>
              ) : (
                pending.map((txn, i) => {
                  const key      = txn.from.userId + txn.to.userId
                  const isMe     = txn.from.userId === session.user.id
                  const theyOweMe = txn.to.userId === session.user.id
                  const upiLink  = getUPILink(txn)
                  const qrOpen   = openQR === key
                  const isPopping = poppingCard === key

                  return (
                    <div key={key} style={{
                      ...s.txnCard,
                      animation: isPopping
                        ? 'settleOut 0.42s cubic-bezier(0.55,0,1,0.45) forwards'
                        : 'slideInUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
                      animationDelay: isPopping ? '0s' : `${i * 0.07}s`,
                      opacity: isPopping ? 1 : 0,
                    }}>
                      {/* from → to */}
                      <div style={s.txnTop}>
                        <div style={{ position:'relative', marginRight:'12px', flexShrink:0 }}>
                          <div style={{ ...s.txnAvatarFrom, background: isMe ? '#FF4D4D22' : C.surface2, color: isMe ? C.red : C.gray1 }}>
                            {txn.from.name[0].toUpperCase()}
                          </div>
                          <div style={s.txnAvatarTo}>
                            {txn.to.name[0].toUpperCase()}
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={s.txnLabel}>
                            {isMe ? 'YOU OWE' : `${txn.from.name.toUpperCase()} OWES`}{' '}
                            {theyOweMe ? 'YOU' : txn.to.name.toUpperCase()}
                          </div>
                          <div style={s.txnGroup}>{groupName}</div>
                        </div>
                        {/* animated amount */}
                        <div style={{ ...s.txnAmt, color: theyOweMe ? C.teal : C.white }}>
                          {isPopping
                            ? <CountTo from={txn.amount} to={0} duration={380} />
                            : `₹${txn.amount.toLocaleString('en-IN')}`}
                        </div>
                      </div>

                      {/* buttons */}
                      <div style={s.txnBtns}>
                        <button
                          style={{ ...s.qrBtnDark, opacity: upiLink ? 1 : 0.45 }}
                          onClick={() => upiLink && setOpenQR(qrOpen ? null : key)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
                            <rect x="3" y="16" width="5" height="5"/>
                            <path d="M16 16h.01M20 16h.01M16 20h.01M20 20h.01M16 12h4v4"/>
                          </svg>
                          {theyOweMe ? 'MY QR' : 'QR'}
                        </button>

                        {isMe ? (
                          <button
                            style={{ ...s.upiBtn, opacity: upiLink ? 1 : 0.45 }}
                            onClick={() => upiLink
                              ? (window.location.href = upiLink)
                              : alert(`${txn.to.name} hasn't added a UPI ID yet`)}
                          >
                            PAY VIA UPI
                          </button>
                        ) : (
                          <button style={s.remindBtn}>REMIND</button>
                        )}

                        <button
                          style={{
                            ...s.settledBtn,
                            ...(settling === key ? s.settledBtnActive : {}),
                          }}
                          onClick={() => markSettled(txn)}
                          disabled={settling === key}
                        >
                          {settling === key ? '✓' : 'DONE ✓'}
                        </button>
                      </div>

                      {/* QR panel */}
                      {qrOpen && upiLink && (
                        <div style={{ ...s.qrPanel, animation:'fadeIn 0.25s ease forwards' }}>
                          <p style={s.qrLabel}>
                            scan to pay {theyOweMe ? 'you' : txn.to.name} · ₹{txn.amount.toLocaleString('en-IN')}
                          </p>
                          <div style={s.qrWrap}>
                            <QRCodeSVG value={upiLink} size={150} bgColor="#1a1a1a" fgColor="#00D4AA" level="M" />
                          </div>
                          <p style={s.qrUpi}>{txn.to.upiId}</p>
                          <p style={s.qrHint}>works with GPay, PhonePe, Paytm</p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* monthly recap */}
              {!showAllClear && (
                <div style={{ ...s.recapCard, animation:'slideInUp 0.4s cubic-bezier(0.22,1,0.36,1) 0.25s both' }}>
                  <p style={s.recapTitle}>monthly recap</p>
                  <p style={s.recapSub}>
                    {settled.length > 0
                      ? `You've settled ${settled.length} payment${settled.length > 1 ? 's' : ''} this session.`
                      : 'Track and settle shared expenses easily.'}
                  </p>
                  <button style={s.recapLink} onClick={() => navigate(`/group/${groupId}`)}>
                    FULL BREAKDOWN &gt;
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div style={s.emptyCard}>
              <p style={{ fontSize:'14px', color:C.gray2, textAlign:'center' }}>
                {settledTxns.length === 0
                  ? 'no history yet'
                  : `${settledTxns.length} payment${settledTxns.length > 1 ? 's' : ''} settled`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* bottom nav */}
      <div style={s.bottomNav}>
        {['Home','Groups','Add','Scan','Settle'].map(label => (
          <button key={label} style={s.navBtn(label === 'Settle')}
            onClick={() => {
              if (label === 'Home')   navigate('/')
              if (label === 'Groups') navigate('/create-group')
              if (label === 'Add')    navigate(`/add/${groupId}`)
              if (label === 'Scan')   navigate('/scan')
            }}>
            {label === 'Add' ? (
              <div style={s.fab}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {label==='Home'   && <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>}
                {label==='Groups' && <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z"/>}
                {label==='Scan'   && <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>}
                {label==='Settle' && <path d="M5 13l4 4L19 7"/>}
              </svg>
            )}
            <span style={{ fontSize:'10px', marginTop: label==='Add'?'4px':'2px' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* keyframe styles injected once */}
      <style>{`
        @keyframes slideInUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
        @keyframes settleOut {
          0%   { opacity:1; transform:scale(1);    filter:brightness(1); }
          30%  { opacity:1; transform:scale(1.04); filter:brightness(1.3) hue-rotate(10deg); }
          100% { opacity:0; transform:scale(0.88) translateY(-12px); filter:brightness(1); }
        }
        @keyframes popIn {
          0%   { opacity:0; transform:scale(0.7); }
          70%  { transform:scale(1.06); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  )
}

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto', position:'relative' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px' },
  menuBtn:{ background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex' },
  logoText:{ fontSize:'20px', fontWeight:'800', color:C.teal, letterSpacing:'-0.5px' },
  avatarBtn:{ width:'36px', height:'36px', borderRadius:'50%', background:C.surface, color:C.white, border:`1px solid ${C.border}`, cursor:'pointer', fontSize:'16px' },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'90px' },
  pageTitle:{ fontSize:'32px', fontWeight:'800', color:C.white, letterSpacing:'-1px', marginBottom:'10px' },
  activeBadge:{ display:'inline-flex', alignItems:'center', gap:'6px', background:'#00D4AA22', border:'1px solid #00D4AA44', borderRadius:'20px', padding:'5px 12px', fontSize:'11px', fontWeight:'700', color:C.teal, letterSpacing:'0.06em' },
  activeDot:{ width:'6px', height:'6px', borderRadius:'50%', background:C.teal },
  tabs:{ display:'flex', background:C.surface, margin:'0 20px', borderRadius:'12px', padding:'4px', gap:'4px' },
  tab:(active)=>({ flex:1, padding:'10px 0', fontSize:'14px', border:'none', borderRadius:'10px', background: active ? C.surface2 : 'transparent', color: active ? C.white : C.gray2, cursor:'pointer', fontWeight: active ? '600' : '400' }),
  txnCard:{ 
  ...glass,
  borderRadius:'20px',
  padding:'18px',
  marginBottom:'14px',
  overflow:'hidden'
},
  txnTop:{ display:'flex', alignItems:'center', marginBottom:'14px' },
  txnAvatarFrom:{ width:'42px', height:'42px', borderRadius:'50%', background:C.surface2, color:C.teal, fontSize:'16px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${C.border2}` },
  txnAvatarTo:{ width:'28px', height:'28px', borderRadius:'50%', background:'#00D4AA22', color:C.teal, fontSize:'12px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${C.bg}`, marginLeft:'-10px', marginTop:'14px' },
  txnLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.06em', marginBottom:'3px' },
  txnGroup:{ fontSize:'16px', fontWeight:'700', color:C.white },
  txnAmt:{ fontSize:'24px', fontWeight:'800', letterSpacing:'-0.5px', minWidth:'80px', textAlign:'right' },
  txnBtns:{ display:'flex', gap:'8px' },
  qrBtnDark:{ display:'flex', alignItems:'center', gap:'6px', padding:'11px 14px', background:C.surface2, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', fontSize:'12px', fontWeight:'600', cursor:'pointer' },
  upiBtn:{ flex:1, padding:'11px 0', background:C.teal, color:'#000', border:'none', borderRadius:'12px', fontSize:'12px', fontWeight:'800', cursor:'pointer', letterSpacing:'0.04em' },
  remindBtn:{ flex:1, padding:'11px 0', background:'transparent', color:C.teal, border:`1px solid #00D4AA44`, borderRadius:'12px', fontSize:'12px', fontWeight:'700', cursor:'pointer' },
  settledBtn:{ padding:'11px 14px', background:C.surface2, color:C.gray1, border:`1px solid ${C.border2}`, borderRadius:'12px', fontSize:'11px', fontWeight:'700', cursor:'pointer', letterSpacing:'0.04em', transition:'background 0.2s, color 0.2s' },
  settledBtnActive:{ background:C.teal, color:'#000', border:`1px solid ${C.teal}` },
  qrPanel:{ marginTop:'16px', paddingTop:'16px', borderTop:`1px solid ${C.border}`, textAlign:'center' },
  qrLabel:{ fontSize:'12px', color:C.gray1, marginBottom:'14px' },
  qrWrap:{ display:'inline-block', padding:'16px', background:C.surface2, borderRadius:'16px', marginBottom:'10px' },
  qrUpi:{ fontSize:'13px', color:C.teal, fontWeight:'600', marginBottom:'4px', fontFamily:'monospace' },
  qrHint:{ fontSize:'11px', color:C.gray2 },
  recapCard:{ 
  ...glass,
  borderRadius:'20px',
  padding:'20px',
  marginTop:'4px'
},
  recapTitle:{ fontSize:'20px', fontWeight:'700', color:C.white, marginBottom:'8px' },
  recapSub:{ fontSize:'14px', color:C.gray1, lineHeight:'1.6', marginBottom:'14px' },
  recapLink:{ fontSize:'12px', fontWeight:'700', color:C.teal, background:'none', border:'none', cursor:'pointer', letterSpacing:'0.06em' },
  allClearCard:{ 
  ...glass,
  borderRadius:'20px',
  padding:'40px 24px',
  textAlign:'center'
},
  allClearIconWrap:{ width:'64px', height:'64px', borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', boxShadow:'0 0 28px #00D4AA66' },
  allClearTitle:{ fontSize:'22px', fontWeight:'800', color:C.white, marginBottom:'8px' },
  allClearSub:{ fontSize:'14px', color:C.gray2 },
  emptyCard:{ 
  ...glass,
  borderRadius:'16px',
  padding:'28px'
},
  bottomNav:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:'#161616', borderTop:'1px solid #222', display:'flex', alignItems:'flex-end', padding:'8px 0 14px', zIndex:100 },
  navBtn:(active)=>({ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', color:active?C.teal:'#555', fontSize:'10px', fontWeight:active?'600':'400', padding:'4px 0' }),
  fab:{ width:'50px', height:'50px', borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'-4px', boxShadow:`0 0 18px ${C.teal}55` },
}