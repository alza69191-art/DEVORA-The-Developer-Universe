import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { AuthError, enforceRateLimit } from "@/lib/auth";
import { hashPassword, randomToken, sha256, validEmail, validUsername } from "@/lib/security";
import { sendActionLink } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.APP_URL || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      return NextResponse.json({ error: "Account email delivery is not configured yet." }, { status: 503 });
    }
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim().slice(0, 100);
    await enforceRateLimit(`register:${email}`, 5, 60);
    if (!validUsername(username)) throw new AuthError("Username must be 1–39 characters and use letters, numbers, or internal hyphens.");
    if (!validEmail(email)) throw new AuthError("Enter a valid email address.");
    if (password.length < 12 || password.length > 128) throw new AuthError("Password must be 12–128 characters.");
    const pool = getPool();
    const passwordHash = await hashPassword(password);
    const token = randomToken(32);
    const client = await pool.connect();
    let userId = "";
    try {
      await client.query("BEGIN");
      const user = await client.query<{id:string}>(
        "INSERT INTO devora.users(username,email,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING id",
        [username,email,passwordHash,displayName || username]
      );
      userId = user.rows[0].id;
      const workspaceSlug = `${username}-${userId.slice(0,8)}`;
      const workspace = await client.query<{id:string}>(
        "INSERT INTO devora.workspaces(name,slug,owner_id) VALUES($1,$2,$3) RETURNING id",
        [`${displayName || username}'s workspace`,workspaceSlug,userId]
      );
      await client.query("INSERT INTO devora.workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspace.rows[0].id,userId]);
      await client.query(
        "INSERT INTO devora.email_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'verify_email',NOW()+INTERVAL '24 hours')",
        [userId,sha256(token)]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as {code?:string}).code === "23505") throw new AuthError("Username or email is already registered.", 409);
      throw error;
    } finally { client.release(); }
    const verifyUrl = `${process.env.APP_URL.replace(/\/$/,"")}/api/auth/verify?token=${encodeURIComponent(token)}`;
    try { await sendActionLink(email,verifyUrl,"verify"); }
    catch { return NextResponse.json({ error: "Account created but verification email could not be sent. Configure email delivery and request a new verification link.", accountCreated: true }, { status: 502 }); }
    const session = await createSession(userId);
    const response = NextResponse.json({ ok: true, message: "Check your email to verify your account." }, { status: 201 });
    response.cookies.set(SESSION_COOKIE,session,sessionCookieOptions());
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Registration failed" }, { status });
  }
}
