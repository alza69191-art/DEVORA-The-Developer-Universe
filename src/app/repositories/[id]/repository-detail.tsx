"use client";

import { useEffect,useState } from "react";
import { useParams,useRouter } from "next/navigation";

type Asset={id:string;file_name:string;content_type:string;size_bytes:string;download:string};
type Data={
 repository:{id:string;name:string;description:string|null;visibility:string;default_branch:string;clone_url:string|null;ssh_url:string|null;forgejo_html_url:string|null;canAdmin:boolean};
 git:{branches:Array<{name:string;commit:{id:string}}>;tree:Array<{path:string;type:string;size?:number}>}
};
export default function RepositoryDetail(){
 const params=useParams<{id:string}>();const router=useRouter();
 const [data,setData]=useState<Data|null>(null);const [assets,setAssets]=useState<Asset[]>([]);
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [edit,setEdit]=useState(false);
 const [description,setDescription]=useState("");const [visibility,setVisibility]=useState("private");
 async function load(){
  const response=await fetch(`/api/repositories/${params.id}`);
  const result=await response.json();
  if(response.status===401){router.push("/login");return;}
  if(!response.ok)throw new Error(result.error);
  setData(result);setDescription(result.repository.description??"");setVisibility(result.repository.visibility);
  const files=await fetch(`/api/repositories/${params.id}/assets`);
  if(files.ok){const stored=await files.json();setAssets(stored.assets??[]);}
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[params.id]);
 async function save(){
  setBusy(true);setError("");
  try{const r=await fetch(`/api/repositories/${params.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({description,visibility})});const d=await r.json();if(!r.ok)throw new Error(d.error);setEdit(false);await load();}
  catch(e){setError(e instanceof Error?e.message:"Update failed");}finally{setBusy(false);}
 }
 async function remove(){
  if(!confirm("Delete this repository and its stored metadata? This cannot be undone."))return;
  setBusy(true);
  try{const r=await fetch(`/api/repositories/${params.id}`,{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.error);router.push("/repositories");}
  catch(e){setError(e instanceof Error?e.message:"Delete failed");}finally{setBusy(false);}
 }
 async function upload(file:File){
  const prep=await fetch(`/api/repositories/${params.id}/assets`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:file.name,contentType:file.type||"application/octet-stream",size:file.size})});
  const signed=await prep.json();if(!prep.ok)throw new Error(signed.error);
  const put=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});
  if(!put.ok)throw new Error("Upload failed. Check the R2 bucket CORS configuration.");
  const done=await fetch(`/api/repositories/${params.id}/assets/${signed.assetId}/complete`,{method:"POST"});
  const result=await done.json();if(!done.ok)throw new Error(result.error);
  const listing=await fetch(`/api/repositories/${params.id}/assets`);const stored=await listing.json();setAssets(stored.assets??[]);
 }
 if(error&&!data)return <main className="repo-page"><p className="form-error">{error}</p><a href="/repositories">Back to repositories</a></main>;
 if(!data)return <main className="repo-page">Loading repository…</main>;
 const repo=data.repository;
 return <main className="repo-page">
  <a className="text-btn" href="/repositories">← Repositories</a>
  <header className="repo-header"><div><div className="eyebrow">SOURCE CODE</div><h1>{repo.name}</h1><p>{repo.description||"No description provided"}</p></div><span className="visibility">{repo.visibility.toUpperCase()}</span></header>
  {error&&<p className="form-error">{error}</p>}
  <section className="repo-panel"><h2>Clone and push with HTTPS</h2>
   <label>Git URL<input readOnly value={repo.clone_url||"Git engine URL pending"} onFocus={e=>e.currentTarget.select()}/></label>
   <p className="auth-intro">Create a personal access token in <a href="/settings/tokens">Developer settings → Tokens</a>. Use your DEVORA username as the Git username and the token as the password when Git prompts. The DEVORA Git gateway checks repository permissions before forwarding Git traffic to Forgejo.</p>
   <p className="auth-intro">SSH transport is not enabled yet. HTTPS clone, fetch, and push use the DEVORA token gateway.</p>
  </section>
  {repo.canAdmin&&<section className="repo-panel"><h2>Repository settings</h2>
   {!edit?<button className="primary-btn" onClick={()=>setEdit(true)}>Edit repository</button>:<>
    <label>Description<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={500}/></label>
    <label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="private">Private</option><option value="public">Public</option></select></label>
    <button className="primary-btn" disabled={busy} onClick={save}>{busy?"Saving…":"Save changes"}</button>
    <button className="text-btn" onClick={()=>setEdit(false)}>Cancel</button>
   </>}
   <button className="text-btn" disabled={busy} onClick={remove}>Delete repository</button>
  </section>}
  <section className="repo-panel"><h2>Branches</h2>{data.git.branches.map(b=><div className="repo-row" key={b.name}><b>{b.name}</b><code>{b.commit.id.slice(0,12)}</code></div>)}</section>
  <section className="repo-panel"><h2>Files</h2>{data.git.tree.filter(x=>x.type==="blob").map(f=><div className="repo-row" key={f.path}><span>{f.path}</span><small>{f.size??0} bytes</small></div>)}{!data.git.tree.length&&<p className="auth-intro">This repository has no files yet.</p>}</section>
  <section className="repo-panel"><h2>Upload a file (maximum 25 MB)</h2><input type="file" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{await upload(file);}catch(err){setError(err instanceof Error?err.message:"Upload failed");}}}/></section>
  <section className="repo-panel"><h2>Stored files</h2>{assets.map(a=><div className="repo-row" key={a.id}><span>{a.file_name}</span><small>{Math.ceil(Number(a.size_bytes)/1024)} KB</small><a className="text-btn" href={a.download} target="_blank" rel="noreferrer">Open</a></div>)}{!assets.length&&<p className="auth-intro">No uploaded files yet.</p>}</section>
 </main>;
}
