import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const base=(process.env.FORGEJO_BASE_URL??"").replace(/\/$/,"");
const token=process.env.FORGEJO_API_TOKEN;
const username=process.env.FORGEJO_TEST_USER;
if(!base||!token||!username){console.log("SKIP Git integration: set FORGEJO_BASE_URL, FORGEJO_API_TOKEN, and FORGEJO_TEST_USER.");process.exit(0);}
const name=`devora-git-check-${Date.now()}`;
const response=await fetch(`${base}/api/v1/user/repos`,{method:"POST",headers:{Authorization:`token ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name,private:true,auto_init:true,default_branch:"main"})});
if(!response.ok)throw new Error(`Forgejo repository creation failed: ${response.status}`);
const repo=await response.json();
const directory=await mkdtemp(join(tmpdir(),"devora-git-"));
const askpass=join(directory,process.platform==="win32"?"askpass.cmd":"askpass.sh");
if(process.platform==="win32")await writeFile(askpass,'@echo off\nnode "%~dp0askpass.js" "%~1"\n');
else await writeFile(askpass,'#!/bin/sh\ncase "$1" in *Username*) echo "$FORGEJO_TEST_USER";; *) echo "$FORGEJO_API_TOKEN";; esac\n',{mode:0o700});
const env={...process.env,GIT_ASKPASS:askpass,GIT_TERMINAL_PROMPT:"0",FORGEJO_TEST_USER:username,FORGEJO_API_TOKEN:token};
function git(args,cwd){const r=spawnSync("git",args,{cwd,env,encoding:"utf8"});if(r.status!==0)throw new Error(`git ${args[0]} failed: ${(r.stderr??"").slice(0,500)}`);return r.stdout;}
try{
 const cloneUrl=String(repo.clone_url).replace(/^https:\/\//,"https://");
 git(["clone",cloneUrl,"checkout"],directory);
 const work=join(directory,"checkout");
 await writeFile(join(work,"README.md"),"DEVORA Git integration test\n");
 git(["config","user.name","DEVORA CI"],work);git(["config","user.email","ci@devora.invalid"],work);
 git(["add","README.md"],work);git(["commit","-m","test clone and push"],work);git(["push","origin","HEAD:main"],work);
 const refs=git(["ls-remote","origin","refs/heads/main"],work);
 if(!refs.trim())throw new Error("Git push did not publish main");
 console.log("PASS Forgejo clone, commit, push, and ls-remote");
}finally{
 try{await fetch(`${base}/api/v1/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(name)}`,{method:"DELETE",headers:{Authorization:`token ${token}`}});}catch{}
 await rm(directory,{recursive:true,force:true});
}
