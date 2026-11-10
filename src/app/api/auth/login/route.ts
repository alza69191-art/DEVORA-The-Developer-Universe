import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { AuthError, createSession, enforceRateLimit, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { verifyPassword } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!process.env.APP_URL || !origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    await enforceRateLimit(`login:${email}`, 10, 15);
    const pool = getPool();
    const result = await pool.query<{id:string;password_hash:string|null;email_verified_at:Date|null;account_status:string}>(
      "SELECT id,password_hash,email_verified_at,account_status FROM devora.users WHERE email=$1",[email]
    );
    const user = result.rows[0];
    const valid = user?.password_hash ? await verifyPassword(password,user.password_hash) : false;
    if (!valid) throw new AuthError("Email or password is incorrect.", 401);
    if (user.account_status !== "active") throw new AuthError("This account is unavailable.", 403);
    if (!user.email_verified_at) throw new AuthError("Verify your email before signing in.", 403);
    const session = await createSession(user.id);
    await pool.query("UPDATE devora.users SET last_login_at=NOW() WHERE id=$1",[user.id]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE,session,sessionCookieOptions());
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed" }, { status });
  }
}
