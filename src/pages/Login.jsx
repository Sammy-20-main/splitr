import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C, glass } from '../theme'

// ── Particle canvas ───────────────────────────────────────────────────────────
function ParticleCanvas({ trigger }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!trigger) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let particles = []

    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    function burst(x, y, count = 36) {
      const colors = ['#00D4AA','#00FFD1','#00B894','#5FFFDA','#ffffff','#FFD700']
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
        const speed = 1.6 + Math.random() * 3.5
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size:  2.5 + Math.random() * 4.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.013 + Math.random() * 0.01,
          gravity: 0.07,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.18,
          shape: Math.random() > 0.45 ? 'rect' : 'circle',
        })
      }
    }

    const cx = canvas.width / 2
    const cy = canvas.height * 0.35
    burst(cx, cy, 44)
    setTimeout(() => burst(cx, cy, 22), 160)

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
          ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.fill()
        } else {
          ctx.fillRect(-p.size, -p.size/2, p.size*2, p.size)
        }
        ctx.restore()
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity; p.vx *= 0.98
        p.alpha    -= p.decay
        p.rotation += p.spin
      }
      if (particles.length > 0) animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [trigger])

  return (
    <canvas ref={canvasRef} style={{
      position:'absolute', inset:0, width:'100%', height:'100%',
      pointerEvents:'none', zIndex:0,
    }}/>
  )
}

// ── OTP digit input ───────────────────────────────────────────────────────────
function OTPInput({ value, onChange, disabled, shake }) {
  const inputs = useRef([])

  function handleKey(e, idx) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  function handleChange(e, idx) {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    const arr = value.split('')
    arr[idx] = v
    const next = arr.join('').padEnd(6, '')
    onChange(next)
    if (v && idx < 5) inputs.current[idx + 1]?.focus()
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (pasted.length === 6) {
      onChange(pasted)
      inputs.current[5]?.focus()
    }
    e.preventDefault()
  }

  return (
    <div style={os.wrap} className={shake ? 'shake' : ''}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          disabled={disabled}
          style={{
            ...os.box,
            background: value[i] ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.05)',
            border: value[i]
              ? '1.5px solid rgba(0,212,170,0.6)'
              : '1.5px solid rgba(255,255,255,0.1)',
            color: value[i] ? C.teal : C.white,
          }}
        />
      ))}
    </div>
  )
}

const os = {
  wrap:{ display:'flex', gap:'8px', justifyContent:'center', margin:'16px 0' },
  box:{
    width:'42px', height:'52px', textAlign:'center',
    fontSize:'22px', fontWeight:'700',
    borderRadius:'12px', outline:'none',
    backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
    transition:'border 0.2s, background 0.2s',
  },
}

// ── main Login ────────────────────────────────────────────────────────────────
export default function Login() {
  const [step,      setStep]     = useState('email')  // email | otp
  const [email,     setEmail]    = useState('')
  const [otp,       setOtp]      = useState('')
  const [keepMe,    setKeepMe]   = useState(true)
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')
  const [resendCd,  setResendCd] = useState(0)        // countdown seconds
  const [visible,   setVisible]  = useState(false)
  const [burst,     setBurst]    = useState(0)
  const [otpShake,  setOtpShake] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  // resend countdown
  useEffect(() => {
    if (resendCd <= 0) return
    timerRef.current = setTimeout(() => setResendCd(r => r - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [resendCd])

  async function sendOTP(e) {
    e?.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo:  undefined,   // OTP mode — no redirect link
      },
    })
    if (err) {
      setError(err.message)
    } else {
      setStep('otp')
      setResendCd(30)
      setBurst(b => b + 1)
    }
    setLoading(false)
  }

  async function verifyOTP(e) {
    e?.preventDefault()
    if (otp.length < 6) return
    setLoading(true); setError('')

    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type:  'email',
    })

    if (err) {
      setError('Invalid code — please try again')
      setOtpShake(true)
      setOtp('')
      setTimeout(() => setOtpShake(false), 500)
    }
    // on success Supabase sets the session → App.jsx picks it up automatically
    setLoading(false)
  }

  // auto-verify when all 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && step === 'otp') verifyOTP()
  }, [otp])

  return (
    <div style={s.page}>
      <ParticleCanvas trigger={burst} />

      {/* logo */}
      <div style={{
        ...s.top,
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition:'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={s.logo}>splitr</div>
        <p style={s.tagline}>split expenses, not friendships</p>
      </div>

      {/* card */}
      <div style={{
        ...s.cardWrap,
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition:'opacity 0.65s ease 0.15s, transform 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s',
      }}>

        {/* ── EMAIL STEP ── */}
        {step === 'email' && (
          <form onSubmit={sendOTP} style={{ ...glass, padding:'24px' }}>
            <p style={s.cardTitle}>sign in</p>

            <label style={s.label}>your email</label>
            <input
              type="email"
              placeholder="you@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={s.input}
            />

            {/* keep me logged in */}
            <label style={s.checkRow} onClick={() => setKeepMe(v => !v)}>
              <div style={{ ...s.checkBox, background: keepMe ? C.teal : 'transparent', borderColor: keepMe ? C.teal : 'rgba(255,255,255,0.2)' }}>
                {keepMe && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={s.checkLabel}>keep me logged in</span>
            </label>

            {error && <p style={s.errorText}>{error}</p>}

            <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.65 : 1 }}>
              {loading ? 'sending…' : 'send OTP →'}
            </button>
            <p style={s.hint}>we'll send a 6-digit code to your email</p>
          </form>
        )}

        {/* ── OTP STEP ── */}
        {step === 'otp' && (
          <div style={{ ...glass, padding:'24px' }}>
            <button onClick={() => { setStep('email'); setOtp(''); setError('') }} style={s.backBtn}>
              ← back
            </button>
            <p style={s.cardTitle}>enter code</p>
            <p style={s.otpSub}>
              sent to <span style={{ color:C.teal }}>{email}</span>
            </p>

            <OTPInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              shake={otpShake}
            />

            {error && <p style={{ ...s.errorText, textAlign:'center' }}>{error}</p>}

            {loading && (
              <p style={{ ...s.hint, textAlign:'center', marginTop:'8px' }}>verifying…</p>
            )}

            <div style={s.resendRow}>
              {resendCd > 0 ? (
                <p style={s.hint}>resend in {resendCd}s</p>
              ) : (
                <button onClick={sendOTP} style={s.resendBtn}>resend code</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ambient glow */}
      <div style={s.glow} />
    </div>
  )
}

const s = {
  page:{
    position:'relative', overflow:'hidden',
    minHeight:'100dvh', background:C.bg,
    display:'flex', flexDirection:'column',
    justifyContent:'center', padding:'40px 24px',
  },
  top:{ marginBottom:'40px', position:'relative', zIndex:1 },
  logo:{ fontSize:'52px', fontWeight:'800', color:C.teal, letterSpacing:'-2.5px', marginBottom:'8px', textShadow:'0 0 40px #00D4AA55' },
  tagline:{ fontSize:'15px', color:C.gray1 },
  cardWrap:{ position:'relative', zIndex:1 },
  cardTitle:{ fontSize:'20px', fontWeight:'700', color:C.white, marginBottom:'18px' },
  label:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'8px' },
  input:{
    width:'100%', padding:'14px 16px', fontSize:'16px',
    background:'rgba(255,255,255,0.05)',
    backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
    color:C.white,
    border:'1.5px solid rgba(255,255,255,0.1)',
    borderRadius:'12px', outline:'none', marginBottom:'14px',
    transition:'border 0.2s',
  },
  checkRow:{
    display:'flex', alignItems:'center', gap:'10px',
    cursor:'pointer', marginBottom:'18px', userSelect:'none',
  },
  checkBox:{
    width:'20px', height:'20px', borderRadius:'6px',
    border:'1.5px solid', flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    transition:'background 0.2s, border-color 0.2s',
  },
  checkLabel:{ fontSize:'13px', color:C.gray1 },
  errorText:{ fontSize:'12px', color:C.red, marginBottom:'10px' },
  btn:{
    width:'100%', padding:'15px',
    background:C.teal, color:'#000',
    border:'none', borderRadius:'50px',
    fontSize:'16px', fontWeight:'700', cursor:'pointer', marginBottom:'12px',
  },
  hint:{ fontSize:'12px', color:C.gray2, textAlign:'center' },
  backBtn:{
    background:'none', border:'none', color:C.gray1,
    fontSize:'13px', cursor:'pointer', marginBottom:'14px',
    padding:'0',
  },
  otpSub:{ fontSize:'13px', color:C.gray1, marginBottom:'4px' },
  resendRow:{ display:'flex', justifyContent:'center', marginTop:'16px' },
  resendBtn:{
    background:'none', border:'none', color:C.teal,
    fontSize:'13px', fontWeight:'600', cursor:'pointer',
  },
  glow:{
    position:'absolute', bottom:'-80px', left:'50%',
    transform:'translateX(-50%)',
    width:'300px', height:'300px', borderRadius:'50%',
    background:'radial-gradient(circle, #00D4AA18 0%, transparent 70%)',
    pointerEvents:'none', zIndex:0,
  },
}