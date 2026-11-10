import {NextRequest,NextResponse} from "next/server";
import {getPool} from "@/lib/db";
import {requireRepositoryAccess,AuthError} from "@/lib/auth";
import {sha256} from "@/lib/security";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

async function proxy(request:NextRequest,context:{params:Promise<{path:string[]}>}){
 try{
  const parts=(await context.params).path;
  if(parts.length<2||!parts[1].endsWith(".git"))throw new AuthError("Invalid Git endpoint",404);
  const owner=parts[0];const repoName=parts[1].slice(0,-4);
  const service=request.nextUrl.searchParams.get("service");
  const isWrite=request.method==="POST"&&parts.at(-1)==="git-receive-pack"||service==="git-receive-pack";
  const authorization=request.headers.get("authorization")??"";
  if(!authorization.startsWith("Basic "))return new NextResponse("DEVORA personal access token required.",{status:401,headers:{"WWW-Authenticate":'Basic realm="DEVORA Git"'}});
  let credentials="";
  try{credentials=Buffer.from(authorization.slice(6),"base64").toString("utf8");}catch{throw new AuthError("Invalid Git credentials",401);}
  const split=credentials.indexOf(":");
  if(split<1)throw new AuthError("Invalid Git credentials",401);
  const username=credentials.slice(0,split);const token=credentials.slice(split+1);
  if(!token.startsWith("dvr_"))throw new AuthError("Use a DEVORA personal access token as the Git password.",401);
  const pool=getPool();
  const auth=await pool.query<{id:string;username:string;scopes:string[]}>(
   `SELECT u.id,u.username,t.scopes FROM devora.api_tokens t JOIN devora.users u ON u.id=t.user_id
    WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>NOW()) AND u.account_status='active' AND u.email_verified_at IS NOT NULL`,
   [sha256(token)]);
  const actor=auth.rows[0];
  if(!actor||actor.username!==username)throw new AuthError("Git credentials are invalid or expired",401);
  const remote=await pool.query<{id:string;forgejo_owner:string;forgejo_name:string}>(
   "SELECT id,forgejo_owner,forgejo_name FROM devora.repositories WHERE forgejo_owner=$1 AND forgejo_name=$2",
   [owner,repoName]);
  if(!remote.rowCount)throw new AuthError("Repository not found",404);
  const repo=remote.rows[0];
  await requireRepositoryAccess(repo.id,actor.id,isWrite?"write":"read");
  const requiredScope=isWrite?"repo:write":"repo:read";
  if(!actor.scopes.includes(requiredScope))throw new AuthError(`Token requires ${requiredScope} scope`,403);
  await pool.query("UPDATE devora.api_tokens SET last_used_at=NOW() WHERE token_hash=$1",[sha256(token)]);
  const base=process.env.FORGEJO_BASE_URL?.replace(/\/+$/,"");
  const serviceUser=process.env.FORGEJO_OWNER;
  const serviceToken=process.env.FORGEJO_API_TOKEN;
  if(!base||!serviceUser||!serviceToken)throw new AuthError("Git engine is not configured",503);
  const suffix=parts.slice(2).map(encodeURIComponent).join("/");
  const target=`${base}/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}.git${suffix?"/"+suffix:""}${request.nextUrl.search}`;
  const headers=new Headers();
  for(const key of ["accept","content-type","content-encoding","user-agent","git-protocol"]) {
   const value=request.headers.get(key);if(value)headers.set(key,value);
  }
  headers.set("authorization",`Basic ${Buffer.from(`${serviceUser}:${serviceToken}`).toString("base64")}`);
  headers.set("x-forwarded-host",request.headers.get("host")??"");
  const init:RequestInit & {duplex?:"half"}={method:request.method,headers,redirect:"manual",cache:"no-store"};
  if(request.method!=="GET"&&request.method!=="HEAD"){init.body=request.body;init.duplex="half";}
  const upstream=await fetch(target,init);
  const responseHeaders=new Headers();
  for(const key of ["content-type","cache-control","pragma","expires","content-disposition","www-authenticate"]) {
   const value=upstream.headers.get(key);if(value)responseHeaders.set(key,value);
  }
  return new NextResponse(request.method==="HEAD"?null:upstream.body,{status:upstream.status,headers:responseHeaders});
 }catch(error){
  const status=error instanceof AuthError?error.status:500;
  return new NextResponse(error instanceof Error?error.message:"Git proxy failed",{status});
 }
}
export const GET=proxy;
export const POST=proxy;
export const HEAD=proxy;
