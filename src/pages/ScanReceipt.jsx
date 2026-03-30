import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { C } from '../theme'

export default function ScanReceipt({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const fileRef = useRef(null)
  const preselectedGroupId = location.state?.groupId || null

  const [preview, setPreview] = useState(null)
  const [base64, setBase64] = useState(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(preselectedGroupId || '')

  useState(() => {
    supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', session.user.id)
      .then(({ data }) => {
        const g = data?.map(d => d.groups).filter(Boolean) || []
        setGroups(g)
        if (!selectedGroup && g.length > 0) setSelectedGroup(g[0].id)
      })
  }, [])

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null); setParsed(null)
    setPreview(URL.createObjectURL(file))
    setMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = (ev) => setBase64(ev.target.result.split(',')[1])
    reader.readAsDataURL(file)
  }

  async function parseReceipt() {
    if (!base64) return
    setParsing(true); setError(null)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: `You are a receipt parser. Reply ONLY with raw JSON, no markdown, no explanation:\n{"merchant":"","date":"","items":[{"name":"","price":0}],"subtotal":0,"tax":0,"total":0}` }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Gemini API error')
      
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      // Added more robust cleaning to handle cases where Gemini includes Markdown
      const clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
      const result = JSON.parse(clean)

      // --- SMART FALLBACK ---
      // If the AI returns 0 for the total (because it's cut off in the photo),
      // we calculate it ourselves from the individual item prices.
      if (!result.total || result.total === 0) {
        const calculatedTotal = result.items?.reduce((sum, item) => {
          return sum + (Number(item.price) || 0);
        }, 0) || 0;
        
        result.total = calculatedTotal;
      }
      // ----------------------

      setParsed(result)
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Could not read receipt. Try a clearer photo.' : err.message)
    }
    setParsing(false)
  }

  function handleAddToGroup() {
    if (!parsed || !selectedGroup) return
    navigate(`/add/${selectedGroup}`, { state: { prefill: { description: parsed.merchant || 'Receipt expense', amount: parsed.total || 0 } } })
  }

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button style={s.menuBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <span style={s.logoText}>splitr</span>
        <button onClick={() => navigate(-1)} style={s.avatarBtn}>←</button>
      </div>

      <div style={s.scroll}>
        <div style={{ padding:'20px 20px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <h1 style={s.pageTitle}>Scan Receipt</h1>
            <span style={s.aiBadge}>AI</span>
          </div>
          <p style={s.pageSub}>Extracting details automatically</p>
        </div>

        {/* upload zone */}
        <div style={{ padding:'0 20px' }}>
          <div style={{ ...s.dropZone, ...(preview ? s.dropZoneSmall : {}) }}
            onClick={() => fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="receipt" style={s.previewImg} />
            ) : (
              <>
                <div style={s.cameraIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gray1} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <p style={s.uploadTitle}>Upload receipt photo</p>
                <p style={s.uploadSub}>JPG or PNG up to 10MB</p>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={handleFileChange} style={{ display:'none' }} />

          {preview && (
            <button style={s.retakeBtn} onClick={() => fileRef.current?.click()}>retake photo</button>
          )}

          {base64 && !parsed && (
            <button style={{ ...s.parseBtn, opacity: parsing ? 0.7 : 1 }}
              onClick={parseReceipt} disabled={parsing}>
              {parsing ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <span style={s.spinner} /> reading receipt...
                </span>
              ) : 'read receipt with AI'}
            </button>
          )}

          {error && (
            <div style={s.errorBox}>
              <p style={s.errorText}>{error}</p>
              <button style={s.retryBtn} onClick={parseReceipt}>try again</button>
            </div>
          )}

          {/* parsed result */}
          {parsed && (
            <div style={s.resultCard} className="fadeUp">
              <div style={s.resultHeader}>
                <div>
                  <h2 style={s.merchantName}>{parsed.merchant || 'Receipt'}</h2>
                  {parsed.date && <p style={s.merchantDate}>{parsed.date.toUpperCase()}</p>}
                </div>
                <div style={s.restaurantIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8" strokeLinecap="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
                </div>
              </div>

              <div style={s.divider} />

              {parsed.items?.map((item, i) => (
                <div key={i} style={s.itemRow}>
                  <div>
                    <div style={s.itemName}>{item.name}</div>
                  </div>
                  <div style={s.itemPrice}>₹{Number(item.price).toLocaleString('en-IN')}</div>
                </div>
              ))}

              <div style={s.divider} />

              <div style={s.totalRow}>
                <span style={s.totalLabel}>TOTAL AMOUNT</span>
                <span style={s.totalAmt}>₹{Number(parsed.total).toLocaleString('en-IN')}</span>
              </div>

              <div style={{ marginTop:'16px' }}>
                <div style={s.groupLabel}>ASSIGN TO GROUP</div>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={s.select}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* tips */}
          {!preview && (
            <div style={s.tipCard}>
              <p style={s.tipTitle}>tips for best results</p>
              <p style={s.tipItem}>• lay the receipt flat with good lighting</p>
              <p style={s.tipItem}>• make sure the total is clearly visible</p>
              <p style={s.tipItem}>• works with printed and digital receipts</p>
            </div>
          )}
        </div>
      </div>

      {parsed && (
        <div style={s.footer}>
          <button style={{ ...s.addBtn, opacity: !selectedGroup ? 0.5 : 1 }}
            onClick={handleAddToGroup} disabled={!selectedGroup}>
            Confirm and Add
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        </div>
      )}

      {/* bottom nav */}
      <div style={s.bottomNav}>
        {['Home','Groups','Add','Scan','Settle'].map((label) => (
          <button key={label} style={s.navBtn(label === 'Scan')}
            onClick={() => {
              if (label === 'Home') navigate('/')
              else if (label === 'Groups') navigate('/create-group')
              else if (label === 'Add') navigate(selectedGroup ? `/add/${selectedGroup}` : '/')
              else if (label === 'Settle') navigate(selectedGroup ? `/settle/${selectedGroup}` : '/')
            }}>
            {label === 'Add' ? (
              <div style={s.fab}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {label==='Home'&&<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>}
                {label==='Groups'&&<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z"/>}
                {label==='Scan'&&<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>}
                {label==='Settle'&&<path d="M5 13l4 4L19 7"/>}
              </svg>
            )}
            <span style={{ fontSize:'10px', marginTop: label==='Add'?'4px':'2px' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const s = {
  page:{ display:'flex', flexDirection:'column', minHeight:'100dvh', background:C.bg, maxWidth:'480px', margin:'0 auto' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px' },
  menuBtn:{ background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex' },
  logoText:{ fontSize:'20px', fontWeight:'800', color:C.teal, letterSpacing:'-0.5px' },
  avatarBtn:{ width:'36px', height:'36px', borderRadius:'50%', background:C.surface, color:C.white, border:`1px solid ${C.border}`, cursor:'pointer', fontSize:'16px' },
  scroll:{ flex:1, overflowY:'auto', paddingBottom:'120px' },
  pageTitle:{ fontSize:'28px', fontWeight:'800', color:C.white, letterSpacing:'-0.5px' },
  aiBadge:{ fontSize:'11px', fontWeight:'800', background:C.teal, color:'#000', padding:'3px 8px', borderRadius:'6px' },
  pageSub:{ fontSize:'14px', color:C.gray1 },
  dropZone:{ background:C.surface, border:`1.5px dashed ${C.border2}`, borderRadius:'16px', padding:'40px 20px', textAlign:'center', cursor:'pointer', marginBottom:'14px' },
  dropZoneSmall:{ padding:'8px', border:`1px solid ${C.border}` },
  previewImg:{ width:'100%', borderRadius:'10px', maxHeight:'260px', objectFit:'contain' },
  cameraIcon:{ width:'56px', height:'56px', borderRadius:'50%', background:C.surface2, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' },
  uploadTitle:{ fontSize:'15px', fontWeight:'600', color:C.white, marginBottom:'4px' },
  uploadSub:{ fontSize:'12px', color:C.gray2 },
  retakeBtn:{ width:'100%', padding:'12px', background:'none', border:`1px solid ${C.border2}`, borderRadius:'12px', fontSize:'14px', color:C.gray1, cursor:'pointer', marginBottom:'10px' },
  parseBtn:{ width:'100%', padding:'15px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'15px', fontWeight:'700', cursor:'pointer', marginBottom:'14px' },
  spinner:{ width:'14px', height:'14px', border:'2px solid rgba(0,0,0,0.3)', borderTop:'2px solid #000', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' },
  errorBox:{ background:'#FF4D4D15', border:'1px solid #FF4D4D33', borderRadius:'12px', padding:'14px', marginBottom:'14px' },
  errorText:{ fontSize:'13px', color:C.red, marginBottom:'8px' },
  retryBtn:{ fontSize:'12px', color:C.red, background:'none', border:`1px solid ${C.red}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer' },
  resultCard:{ background:C.surface, borderRadius:'20px', border:`1px solid ${C.border}`, padding:'18px', marginBottom:'14px' },
  resultHeader:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' },
  merchantName:{ fontSize:'22px', fontWeight:'800', color:C.white, letterSpacing:'-0.5px', marginBottom:'4px' },
  merchantDate:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em' },
  restaurantIcon:{ width:'40px', height:'40px', borderRadius:'50%', background:C.surface2, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.border2}` },
  divider:{ height:'1px', background:C.border, margin:'12px 0' },
  itemRow:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:`1px solid ${C.border}` },
  itemName:{ fontSize:'14px', fontWeight:'500', color:C.white },
  itemPrice:{ fontSize:'14px', fontWeight:'700', color:C.white },
  totalRow:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' },
  totalLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em' },
  totalAmt:{ fontSize:'24px', fontWeight:'800', color:C.teal, letterSpacing:'-0.5px' },
  groupLabel:{ fontSize:'11px', fontWeight:'600', color:C.gray2, letterSpacing:'0.08em', marginBottom:'8px' },
  select:{ width:'100%', padding:'14px 16px', fontSize:'15px', background:C.surface2, color:C.white, border:`1px solid ${C.border2}`, borderRadius:'12px', outline:'none' },
  tipCard:{ background:C.surface, borderRadius:'16px', padding:'16px', border:`1px solid ${C.border}` },
  tipTitle:{ fontSize:'13px', fontWeight:'600', color:C.white, marginBottom:'10px' },
  tipItem:{ fontSize:'13px', color:C.gray1, marginBottom:'6px', lineHeight:'1.5' },
  footer:{ position:'fixed', bottom:'70px', left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:C.bg, padding:'10px 20px', borderTop:`1px solid ${C.border}` },
  addBtn:{ width:'100%', padding:'15px', background:C.teal, color:'#000', border:'none', borderRadius:'50px', fontSize:'15px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
  bottomNav:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:'#161616', borderTop:'1px solid #222', display:'flex', alignItems:'flex-end', padding:'8px 0 14px', zIndex:100 },
  navBtn:(active)=>({ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', color:active?C.teal:'#555', fontSize:'10px', fontWeight:active?'600':'400', padding:'4px 0' }),
  fab:{ width:'50px', height:'50px', borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'-4px', boxShadow:`0 0 18px ${C.teal}55` },
}