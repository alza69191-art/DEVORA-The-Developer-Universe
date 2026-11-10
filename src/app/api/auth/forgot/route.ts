import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { enforceRateLimit } from "@/lib/auth";
import { randomToken, sha256, validEmail } from "@/lib/security";
import { sendActionLink } from "@/lib/email";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!process.env.APP_URL || !origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({error:"Invalid request origin"},{status:403});
  try {
    const email = String((await request.json()).email ?? "").trim().toLowerCase();
    await enforceRateLimit(`forgot:${request.headers.get("x-forwarded-for") ?? "unknown"}`,5,30);
    if (validEmail(email) && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      const pool = getPool();
      const found = await pool.query<{id:string}>("SELECT id FROM devora.users WHERE email=$1 AND email_verified_at IS NOT NULL AND account_status='active'",[email]);
      if (found.rowCount) {
        const token = randomToken(32);
        await pool.query("INSERT INTO devora.email_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset_password',NOW()+INTERVAL '30 minutes')",[found.rows[0].id,sha256(token)]);
        const url = `${process.env.APP_URL.replace(/\/$/,"")}/reset-password?token=${encodeURIComponent(token)}`;
        await sendActionLink(email,url,"reset");
      }
    }
    return NextResponse.json({ok:true,message:"If the account exists, a reset link will be sent."});
  } catch {
    return NextResponse.json({ok:true,message:"If the account exists, a reset link will be sent."});
  }
}
