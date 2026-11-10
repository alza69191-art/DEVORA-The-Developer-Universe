import {NextRequest,NextResponse} from "next/server";
import {getPool} from "@/lib/db";
import {enforceRateLimit} from "@/lib/auth";
import {randomToken,sha256,validEmail} from "@/lib/security";
import {sendActionLink} from "@/lib/email";

export const runtime="nodejs";
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
 try{
  const email=String((await request.json()).email??"").trim().toLowerCase();
  await enforceRateLimit(`resend:${email}`,3,60);
  if(validEmail(email)&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM){
   const pool=getPool();const user=await pool.query<{id:string}>("SELECT id FROM devora.users WHERE email=$1 AND email_verified_at IS NULL AND account_status='active'",[email]);
   if(user.rowCount){
    const token=randomToken(32);
    await pool.query("UPDATE devora.email_tokens SET consumed_at=NOW() WHERE user_id=$1 AND purpose='verify_email' AND consumed_at IS NULL",[user.rows[0].id]);
    await pool.query("INSERT INTO devora.email_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'verify_email',NOW()+INTERVAL '24 hours')",[user.rows[0].id,sha256(token)]);
    await sendActionLink(email,`${process.env.APP_URL.replace(/\/$/,"")}/api/auth/verify?token=${encodeURIComponent(token)}`,"verify");
   }
  }
  return NextResponse.json({ok:true,message:"If the account needs verification, a new link will be sent."});
 }catch{return NextResponse.json({ok:true,message:"If the account needs verification, a new link will be sent."});}
}
