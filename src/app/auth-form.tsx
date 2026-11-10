"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "forgot" | "reset";
export default function AuthForm({mode}:{mode:Mode}) {
  const router=useRouter();
  const params=useSearchParams();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const title={login:"Welcome back",register:"Create your DEVORA account",forgot:"Recover your account",reset:"Choose a new password"}[mode];
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const data=Object.fromEntries(new FormData(event.currentTarget).entries());
    const endpoint={login:"login",register:"register",forgot:"forgot",reset:"reset"}[mode];
    if(mode==="reset") data.token=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("token")??"":"";
    try {
      const response=await fetch(`/api/auth/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error??"Request failed");
      if(mode==="login") router.push("/repositories");
      else if(mode==="register") {setMessage(result.message??"Check your inbox to verify your email.");}
      else if(mode==="reset") {setMessage("Password updated. Sign in with your new password.");}
      else setMessage(result.message??"If the account exists, a reset link will be sent.");
    } catch(e) {setError(e instanceof Error?e.message:"Request failed");}
    finally {setBusy(false);}
  }
  return <main className="auth-shell"><a className="auth-brand" href="/">DEVORA <span>THE DEVELOPER UNIVERSE</span></a><section className="auth-card"><div className="eyebrow">BUILD. COLLABORATE. CREATE.</div><h1>{title}</h1><p className="auth-intro">{mode==="register"?"Start with a verified email address.":mode==="login"?"Sign in to continue to your workspace.":mode==="forgot"?"We will send a secure recovery link if the account exists.":"The reset link is single-use and expires after 30 minutes."}</p>
    <form onSubmit={submit}>
      {mode==="register"&&<><label>Username<input name="username" minLength={1} maxLength={39} pattern="[A-Za-z0-9-]+" autoComplete="username" required/></label><label>Display name<input name="displayName" maxLength={100} autoComplete="name"/></label></>}
      {mode!=="reset"&&<label>Email address<input name="email" type="email" maxLength={320} autoComplete="email" required/></label>}
      {(mode==="login"||mode==="register"||mode==="reset")&&<label>Password<input name="password" type="password" minLength={mode==="login"?1:12} maxLength={128} autoComplete={mode==="login"?"current-password":"new-password"} required/></label>}
      {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-message" role="status">{message}</div>}
      <button className="primary-btn auth-submit" disabled={busy}>{busy?"Please wait…":{login:"Sign in",register:"Create account",forgot:"Send recovery link",reset:"Update password"}[mode]}</button>
    </form>
    <div className="auth-links">{mode==="login"?<><a href="/register">Create an account</a><a href="/forgot-password">Forgot password?</a></>:mode==="register"?<a href="/login">Already registered? Sign in</a>:<a href="/login">Back to sign in</a>}</div>
  </section><p className="auth-foot">Your credentials are encrypted in transit and never exposed to the browser as server secrets.</p></main>;
}
