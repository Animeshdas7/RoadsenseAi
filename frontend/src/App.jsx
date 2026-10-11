import { useEffect,useState } from 'react'
import './App.css'
import Dashboard from './Dashboard'
import {clearSession,getToken,saveSession,registerAccount,loginAccount,getCurrentUser} from './api'

function App(){
 const [mode,setMode]=useState('login')
 const [adminMode,setAdminMode]=useState(false)
 const [session,setSession]=useState(null)
 const [checking,setChecking]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  ;(getToken()?getCurrentUser().catch(()=>null):Promise.resolve(null))
   .then(result=>{if(!active)return;if(result?.user)setSession(result.user);else clearSession()})
   .finally(()=>{if(active)setChecking(false)})
  return()=>{active=false}
 },[])
 async function submit(e){
  e.preventDefault();setBusy(true);setError('')
  const f=new FormData(e.currentTarget)
  const data={name:String(f.get('name')||''),email:String(f.get('email')||''),password:String(f.get('password')||'')}
  try{
   let result
   if(mode==='register'&&!adminMode) result=await registerAccount(data)
   else result=await loginAccount({email:data.email,password:data.password,accountType:adminMode?'admin':'user'})
   if(adminMode&&result.user.role!=='admin')throw new Error('Could not open admin demo workspace.')
   if(!adminMode&&result.user.role==='admin')throw new Error('This account is currently in admin mode. Use Administrator login.')
   saveSession(result);setSession(result.user)
  }catch(err){setError(err.message||'Could not sign in.')}
  finally{setBusy(false)}
 }
 function signOut(){clearSession();setSession(null);setMode('login');setAdminMode(false);setError('')}
 if(checking)return <main className="login-page"><div className="login-card"><h2>Loading RoadSense AI…</h2></div></main>
 if(session)return <Dashboard user={session} onSignOut={signOut}/>
 return <main className="login-page">
  <div className="login-background"><div className="glow glow-one"></div><div className="glow glow-two"></div><div className="road-lines"></div></div>
  <header className="login-navbar"><a className="login-brand" href="/"><span className="brand-symbol">R</span><span>RoadSense <b>AI</b></span></a><span className="navbar-caption">INTELLIGENCE FOR SAFER JOURNEYS</span></header>
  <section className="login-content">
   <div className="login-intro"><span className="intro-label"><span className="online-dot"></span> SMARTER ROADS. SAFER DECISIONS.</span><h1>Every journey<br/>deserves a<br/><span>safer way.</span></h1><p>Navigate with confidence. Discover road hazards, compare safer routes, and make every journey count.</p><div className="intro-stats"><div><span className="stat-icon">⌖</span><div><strong>Risk-aware</strong><small>Route intelligence</small></div></div><div><span className="stat-icon">◇</span><div><strong>Connected</strong><small>Road safety reports</small></div></div></div></div>
   <div className="login-card">
    <div className="card-top"><div><span className="card-kicker">{adminMode?'ADMINISTRATOR ACCESS':'YOUR ROAD SAFETY WORKSPACE'}</span><h2>{adminMode?'Admin sign in':mode==='login'?'Welcome back.':'Join RoadSense.'}</h2><p>{adminMode?'Enter any valid email and password to open the admin demo workspace.':mode==='login'?'Sign in to continue your journey.':'Create your account to get started.'}</p></div><div className="card-logo">R<span>.</span></div></div>
    {adminMode&&<p className="login-notice">Hackathon demo: use any valid email and password. Admin access is intentionally open for examiner testing.</p>}
    {!adminMode&&<div className="login-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>{setMode('login');setError('')}}>Sign in</button><button type="button" className={mode==='register'?'selected':''} onClick={()=>{setMode('register');setError('')}}>Create account</button></div>}
    <form onSubmit={submit}>
     {mode==='register'&&!adminMode?<label>Full name<input name="name" type="text" minLength="2" maxLength="80" placeholder="Enter your full name" required/></label>:null}
     <label>Email address<input name="email" type="email" autoComplete="username" placeholder="you@example.com" required/></label>
     <label>Password<input name="password" type="password" minLength={mode==='register'&&!adminMode?8:1} maxLength="128" autoComplete={mode==='register'&&!adminMode?'new-password':'current-password'} placeholder='Enter your password' required/></label>
     {error&&<p role="alert" className="login-notice" style={{color:'#fca5a5'}}>{error}</p>}
     <button className="login-submit" type="submit" disabled={busy}>{busy?'Please wait…':adminMode?'Admin sign in':mode==='login'?'Sign in to RoadSense':'Create my account'} <span>→</span></button>
    </form>
    <div className="login-security"><span>◇</span> Passwords are securely hashed on the server</div>
    <p className="login-notice"><button type="button" className="text-link" onClick={()=>{setAdminMode(v=>!v);setMode('login');setError('')}}>{adminMode?'← Back to user login':'Administrator login'}</button></p>
   </div>
  </section>
  <footer className="login-footer"><span>© 2026 RoadSense AI</span><span>BUILT FOR SAFER JOURNEYS <b>✳</b></span></footer>
 </main>
}
export default App
