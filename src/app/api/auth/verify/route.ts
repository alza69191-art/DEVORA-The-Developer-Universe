import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token || token.length > 200) return new NextResponse("Invalid or expired verification link.",{status:400});
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Verify DEVORA email</title></head><body style="font-family:Arial;background:#0b1020;color:#eef;padding:40px"><main style="max-width:480px;margin:auto;background:#151d30;padding:28px;border-radius:12px"><h1>Verify your email</h1><p>Confirm your email address to activate your DEVORA account.</p><form method="post" action="/api/auth/verify"><input type="hidden" name="token" value="${token.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}"><button style="background:#7568e8;color:white;border:0;padding:12px 18px;border-radius:8px">Confirm email</button></form></main></body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
export async function POST(request: NextRequest) {
  const form=await request.formData();
  const token=String(form.get("token")??"");
  if(!token||token.length>200)return NextResponse.redirect(new URL("/login?verified=invalid",request.url));
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    const found=await client.query<{id:string;user_id:string}>("SELECT id,user_id FROM devora.email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",[sha256(token)]);
    if(!found.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(new URL("/login?verified=invalid",request.url));}
    await client.query("UPDATE devora.users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=$1",[found.rows[0].user_id]);
    await client.query("UPDATE devora.email_tokens SET consumed_at=NOW() WHERE id=$1",[found.rows[0].id]);
    await client.query("DELETE FROM devora.sessions WHERE user_id=$1",[found.rows[0].user_id]);
    await client.query("COMMIT");
    return NextResponse.redirect(new URL("/login?verified=success",request.url));
  }catch{await client.query("ROLLBACK");return NextResponse.redirect(new URL("/login?verified=error",request.url));}
  finally{client.release();}
}
