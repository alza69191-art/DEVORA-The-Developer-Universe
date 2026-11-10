"use client";

import { useEffect,useState } from "react";
import { useParams,useRouter } from "next/navigation";

type Data={repository:{id:string;name:string;description:string|null;visibility:string;default_branch:string;clone_url:string|null;ssh_url:string|null;forgejo_html_url:string|null};git:{branches:Array<{name:string;commit:{id:string}}>;tree:Array<{path:string;type:string;size?:number}>}};
export default function RepositoryDetail(){
 const params=useParams<{id:string}>();const router=useRouter();const [data,setData]=useState<Data|null>(null);const [error,setError]=useState("");
 useEffect(()=>{fetch(`/api/repositories/${params.id}`).then(async r=>{const d=await r.json();if(r.status===401){router.push("/login");return;}if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>setError(e.message));},[params.id]);
 if(error)return <main className="repo-page"><p className="form-error">{error}</p><a href="/repositories">Back to repositories</a></main>;
 if(!data)return <main className="repo-page">Loading repository…</main>;
 const repo=data.repository;
 return <main className="repo-page"><a className="text-btn" href="/repositories">← Repositories</a><header className="repo-header"><div><div className="eyebrow">SOURCE CODE</div><h1>{repo.name}</h1><p>{repo.description||"No description provided"}</p></div><span className="visibility">{repo.visibility.toUpperCase()}</span></header>
 <section className="repo-panel"><h2>Clone this repository</h2><label>HTTPS<input readOnly value={repo.clone_url||"Git engine URL pending"} onFocus={e=>e.currentTarget.select()}/></label><label>SSH<input readOnly value={repo.ssh_url||"SSH URL pending"} onFocus={e=>e.currentTarget.select()}/></label><p className="auth-intro">Public clone is available when the Git host is connected. Private Git credentials require the Forgejo identity/SSH-key bridge before external clone and push are enabled.</p></section>
 <section className="repo-panel"><h2>Branches</h2>{data.git.branches.map(b=><div className="repo-row" key={b.name}><b>{b.name}</b><code>{b.commit.id.slice(0,12)}</code></div>)}</section>
 <section className="repo-panel"><h2>Files</h2>{data.git.tree.filter(x=>x.type==="blob").map(f=><div className="repo-row" key={f.path}><span>{f.path}</span><small>{f.size??0} bytes</small></div>)}{!data.git.tree.length&&<p className="auth-intro">This repository has no files yet.</p>}</section>
 <section className="repo-panel"><h2>Upload a file</h2><input type="file" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const prep=await fetch(`/api/repositories/${repo.id}/assets`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:file.name,contentType:file.type||"application/octet-stream",size:file.size})});const signed=await prep.json();if(!prep.ok)throw new Error(signed.error);const put=await fetch(signed.uploadUrl,{method:"PUT",headers:signed.headers,body:file});if(!put.ok)throw new Error("Upload failed. Check R2 bucket CORS configuration.");alert("File uploaded to object storage. Refresh the page to see the asset after listing is enabled.");}catch(err){alert(err instanceof Error?err.message:"Upload failed");}}}/></section>
 </main>;
}
