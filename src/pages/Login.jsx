import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

// ── Particle canvas ───────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let particles = []

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // spawn a burst of particles from centre-ish
    function burst(x, y, count = 28) {
      for (let i = 0; i < count; i++) {
        const angle  = (Math.PI * 2 * i) / count + Math.random() * 0.4
        const speed  = 1.4 + Math.random() * 3.2
        const size   = 2 + Math.random() * 4
        const colors = ['#00D4AA','#00FFD1','#00B894','#5FFFDA','#ffffff']
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.012 + Math.random() * 0.01,
          gravity: 0.06,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.15,
          shape: Math.random() > 0.5 ? 'circle' : 'rect',
        })
      }
    }

    // initial burst from logo area
    setTimeout(() => {
      const cx = canvas.width / 2
      const cy = canvas.height * 0.38
      burst(cx, cy, 40)
      // second smaller burst 180ms later
      setTimeout(() => burst(cx, cy, 20), 180)
    }, 300)

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

        p.x  += p.vx
        p.y  += p.vy
        p.vy += p.gravity
        p.vx *= 0.98
        p.alpha   -= p.decay
        p.rotation += p.spin
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  )
}

// ── Login page ────────────────────────────────────────────────────────────────
export default function Login() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  // staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) alert(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <ParticleCanvas />

      {/* logo block */}
      <div style={{
        ...s.top,
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={s.logo}>splitr</div>
        <p style={s.tagline}>split expenses, not friendships</p>
      </div>

      {/* card */}
      <div style={{
        ...s.cardWrap,
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: 'opacity 0.65s ease 0.15s, transform 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s',
      }}>
        {sent ? (
          <div style={s.card}>
            <div style={s.sentEmoji}>✉️</div>
            <p style={s.sentTitle}>check your inbox</p>
            <p style={s.sentSub}>
              magic link sent to{' '}
              <span style={{ color: C.teal }}>{email}</span>
              {' '}— tap it to sign in
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} style={s.card}>
            <label style={s.label}>your email</label>
            <input
              type="email"
              placeholder="you@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={s.input}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.65 : 1 }}
            >
              {loading ? 'sending…' : 'send magic link →'}
            </button>
            <p style={s.hint}>no password needed</p>
          </form>
        )}
      </div>

      {/* bottom glow */}
      <div style={s.glow} />
    </div>
  )
}

const s = {
  page: {
    position: 'relative', overflow: 'hidden',
    minHeight: '100dvh', background: C.bg,
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', padding: '40px 24px',
  },
  top: { marginBottom: '40px', position: 'relative', zIndex: 1 },
  logo: {
    fontSize: '52px', fontWeight: '800',
    color: C.teal, letterSpacing: '-2.5px',
    marginBottom: '8px',
    textShadow: '0 0 40px #00D4AA55',
  },
  tagline: { fontSize: '15px', color: C.gray1 },
  cardWrap: { position: 'relative', zIndex: 1 },
  card: {
    background: C.surface,
    borderRadius: '20px',
    padding: '24px',
    border: `1px solid ${C.border}`,
  },
  sentEmoji: { fontSize: '36px', textAlign: 'center', display: 'block', marginBottom: '14px' },
  sentTitle: { fontSize: '20px', fontWeight: '700', textAlign: 'center', marginBottom: '10px' },
  sentSub:   { fontSize: '14px', color: C.gray1, lineHeight: '1.6', textAlign: 'center' },
  label: {
    fontSize: '11px', fontWeight: '600', color: C.gray2,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    display: 'block', marginBottom: '8px',
  },
  input: {
    width: '100%', padding: '14px 16px', fontSize: '16px',
    background: C.surface2, color: C.white,
    border: `1px solid ${C.border2}`, borderRadius: '12px',
    outline: 'none', marginBottom: '14px',
  },
  btn: {
    width: '100%', padding: '15px',
    background: C.teal, color: '#000',
    border: 'none', borderRadius: '50px',
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
    marginBottom: '12px',
    transition: 'transform 0.1s, opacity 0.2s',
  },
  hint: { fontSize: '12px', color: C.gray2, textAlign: 'center' },
  glow: {
    position: 'absolute', bottom: '-80px', left: '50%',
    transform: 'translateX(-50%)',
    width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, #00D4AA18 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
}