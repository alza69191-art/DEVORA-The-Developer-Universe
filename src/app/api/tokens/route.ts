import {NextRequest,NextResponse} from "next/server";
import {getPool} from "@/lib/db";
import {requireUser,AuthError,enforceRateLimit} from "@/lib/auth";
import {randomToken,sha256} from "@/lib/security";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 try{const user=await requireUser();const result=await getPool().query("SELECT id,name,token_prefix,scopes,expires_at,last_used_at,created_at FROM devora.api_tokens WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC",[user.id]);return NextResponse.json({tokens:result.rows});}
 catch(e){const status=e instanceof AuthError?e.status:500;return NextResponse.json({error:e instanceof Error?e.message:"Could not list tokens"},{status});}
}
export async function POST(request:NextRequest){
 try{
  const user=await requireUser();const origin=request.headers.get("origin");
  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  await enforceRateLimit(`tokens:${user.id}`,10,60);
  const body=await request.json();const name=String(body.name??"").trim().slice(0,100);
  if(!name)throw new AuthError("Token name is required.");
  const token=`dvr_${randomToken(32)}`;
  const scopes=["repo:read","repo:write"];
  const result=await getPool().query("INSERT INTO devora.api_tokens(user_id,name,token_prefix,token_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $6::int IS NULL THEN NULL ELSE NOW()+($6::int*INTERVAL '1 day') END) RETURNING id,name,token_prefix,scopes,expires_at,created_at",[user.id,name,token.slice(0,12),sha256(token),scopes,body.expiresInDays===null?null:Math.min(365,Math.max(1,Number(body.expiresInDays)||90))]);
  return NextResponse.json({token,record:result.rows[0],warning:"Copy this token now. It will not be shown again."},{status:201});
 }catch(e){const status=e instanceof AuthError?e.status:500;return NextResponse.json({error:e instanceof Error?e.message:"Could not create token"},{status});}
}
