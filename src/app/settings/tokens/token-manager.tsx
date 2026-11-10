"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
type Token={id:string;name:string;token_prefix:string;scopes:string[];expires_at:string|null;last_used_at:string|null;created_at:string};
export default function TokenManager(){
 const router=useRouter();const [tokens,setTokens]=useState<Token[]>([]);const [name,setName]=useState("Git on my computer");const [newToken,setNewToken]=useState("");const [error,setError]=useState("");
 async function load(){const r=await fetch("/api/tokens");if(r.status===401){router.push("/login");return;}const d=await r.json();if(!r.ok)throw new Error(d.error);setTokens(d.tokens);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function create(){setError("");const r=await fetch("/api/tokens",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,expiresInDays:90})});const d=await r.json();if(!r.ok){setError(d.error);return;}setNewToken(d.token);await load();}
 async function revoke(id:string){if(!confirm("Revoke this token? Git operations using it will stop immediately."))return;const r=await fetch(`/api/tokens/${id}`,{method:"DELETE"});if(!r.ok){const d=await r.json();setError(d.error);return;}await load();}
 return <main className="repo-page"><a className="text-btn" href="/repositories">← Repositories</a><header className="repo-header"><div><div className="eyebrow">DEVELOPER SETTINGS</div><h1>Personal access tokens</h1><p>Use a token as your Git password over HTTPS. It is shown only once.</p></div></header>
 <section className="repo-panel"><h2>Create a Git token</h2><label>Token name<input value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label><button className="primary-btn" onClick={create}>Generate token</button>{newToken&&<div className="form-message"><b>Copy this token now:</b><p><code>{newToken}</code></p><p>Use your DEVORA username as the Git username and this token as the password.</p></div>}{error&&<p className="form-error">{error}</p>}</section>
 <section className="repo-panel"><h2>Active tokens</h2>{tokens.map(t=><div className="repo-row" key={t.id}><span><b>{t.name}</b><small>{t.token_prefix}… · {t.scopes.join(", ")}</small></span><small>{t.expires_at?new Date(t.expires_at).toLocaleDateString():"No expiry"}</small><button className="text-btn" onClick={()=>revoke(t.id)}>Revoke</button></div>)}{!tokens.length&&<p className="auth-intro">No active tokens.</p>}</section>
 </main>;
}
