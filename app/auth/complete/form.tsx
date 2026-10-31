'use client';
import {useEffect,useRef,useState} from 'react';
import {Warehouse} from 'lucide-react';
export default function CompleteEmail(){
 const tokens=useRef<{access_token:string,refresh_token:string,recovery:boolean}|null>(null),started=useRef(false);
 const [email,setEmail]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true),[recovery,setRecovery]=useState(false);
 useEffect(()=>{if(started.current)return;started.current=true;const params=new URLSearchParams(window.location.hash.slice(1));
  // Remove credentials from the address/history before making any request.
  window.history.replaceState(null,'','/auth/complete');
  const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
  if(!access_token||!refresh_token){setError('This email link is incomplete or expired. Request a new password-setup link and use the latest email.');setBusy(false);return;}
  tokens.current={access_token,refresh_token,recovery:params.get('type')==='recovery'};setRecovery(tokens.current.recovery);
  fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tokens.current)}).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error);setEmail(data.email);}).catch(()=>{tokens.current=null;setError('This email link could not be verified. Request a new password-setup link.');}).finally(()=>setBusy(false));
 },[]);
 async function proceed(){if(!tokens.current)return;setBusy(true);setError('');try{const res=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...tokens.current,confirmed:true})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Unable to complete verification.');tokens.current=null;window.location.replace(data.redirect);}catch(e){setError((e as Error).message);setBusy(false);}}
 return <main className="password-shell"><section className="login-card"><div className="password-brand"><Warehouse size={26}/>Makhzan</div><h1>{recovery?'Finish password setup':'Complete email verification'}</h1>{email?<><p>This link is for <strong>{email}</strong>. Continue only if this is your account.</p><button className="btn primary" disabled={busy} onClick={proceed}>{busy?'Opening…':recovery?'Continue to choose my password':'Continue to my warehouse'}</button></>:!error&&<p>Verifying your email link…</p>}{error&&<div className="form-error" role="alert">{error}</div>}<a className="auth-back" href="/login?mode=recover">Request a new password-setup link</a><a className="auth-back" href="/login">Back to sign in</a></section></main>;
}
