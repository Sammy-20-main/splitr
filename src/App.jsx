import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import CreateGroup from './pages/CreateGroup'
import Group from './pages/Group'
import JoinGroup from './pages/JoinGroup'
import AddExpense from './pages/AddExpense'
import SettleUp from './pages/SettleUp'
import SetupProfile from './pages/SetupProfile'
import ScanReceipt from './pages/ScanReceipt'
import ExpenseDetail from './pages/ExpenseDetail'
import Friends from './pages/Friends'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#0d0d0d' }}>
      <p style={{ color:'#666', fontSize:'14px' }}>loading...</p>
    </div>
  )

  const auth = (el) => session ? el : <Navigate to="/login" />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"            element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/"                 element={auth(<Home session={session} />)} />
        <Route path="/setup"            element={auth(<SetupProfile session={session} />)} />
        <Route path="/create-group"     element={auth(<CreateGroup session={session} />)} />
        <Route path="/group/:id"        element={auth(<Group session={session} />)} />
        <Route path="/join/:inviteCode" element={auth(<JoinGroup session={session} />)} />
        <Route path="/add/:groupId"     element={auth(<AddExpense session={session} />)} />
        <Route path="/settle/:groupId"  element={auth(<SettleUp session={session} />)} />
        <Route path="/scan"             element={auth(<ScanReceipt session={session} />)} />
        <Route path="/expense/:expenseId" element={auth(<ExpenseDetail session={session} />)} />
        <Route path="/friends"          element={auth(<Friends session={session} />)} />
      </Routes>
    </BrowserRouter>
  )
}