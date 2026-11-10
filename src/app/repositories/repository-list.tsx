"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Repo={id:string;name:string;slug:string;description:string|null;visibility:string;default_branch:string;clone_url:string|null;ssh_url:string|null;created_at:string};
export default function RepositoryList(){
  const [items,setItems]=useState<Repo[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [show,setShow]=useState(false);
  const router=useRouter();
  async function load(){const r=await fetch("/api/repositories");if(r.status===401){router.push("/login");return;}const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.repositories);}
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{const r=await fetch("/api/repositories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error);router.push(`/repositories/${d.repository.id}`);}catch(e){setError(e instanceof Error?e.message:"Could not create repository");}finally{setBusy(false);}}
  return <main className="repo-page"><header className="repo-header"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Repositories</h1><p>Manage your code, visibility, and collaboration.</p></div><button className="primary-btn" onClick={()=>setShow(!show)}>＋ New repository</button></header>
    {show&&<form className="repo-create" onSubmit={create}><h2>Create a repository</h2><label>Repository name<input name="name" maxLength={100} pattern="[A-Za-z0-9_.-]+" required placeholder="my-project"/></label><label>Description<input name="description" maxLength={500} placeholder="What are you building?"/></label><label>Visibility<select name="visibility"><option value="private">Private</option><option value="public">Public</option></select></label><button className="primary-btn" disabled={busy}>{busy?"Creating…":"Create repository"}</button></form>}
    {error&&<p className="form-error">{error}</p>}<div className="repo-list">{items.map(repo=><a className="repo-row" href={`/repositories/${repo.id}`} key={repo.id}><span className="repo-symbol">⌘</span><span className="repo-row-main"><b>{repo.name}</b><small>{repo.description||"No description provided"}</small></span><span className="visibility">{repo.visibility.toUpperCase()}</span><span className="repo-branch">{repo.default_branch}</span></a>)}{!items.length&&!error&&<div className="empty-state">No repositories yet. Create your first repository to get started.</div>}</div>
    <button className="text-btn" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");}}>Sign out</button>
  </main>;
}
