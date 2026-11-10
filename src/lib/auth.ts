import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";

export const SESSION_COOKIE = "devora_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 14;

export type AuthUser = { id: string; username: string; display_name: string | null; email: string; is_admin: boolean };

export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const pool = getPool();
  const result = await pool.query<AuthUser>(
    `SELECT u.id, u.username, u.display_name, u.email, u.is_admin
       FROM devora.sessions s JOIN devora.users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.account_status = 'active'
        AND u.email_verified_at IS NOT NULL`,
    [sha256(token)]
  );
  return result.rows[0] ?? null;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const pool = getPool();
  await pool.query(
    "INSERT INTO devora.sessions(user_id, token_hash, expires_at) VALUES ($1,$2,NOW() + INTERVAL '14 days')",
    [userId, sha256(token)]
  );
  return token;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requireRepositoryAccess(repositoryId: string, userId: string, mode: "read" | "write" = "read") {
  const pool = getPool();
  const result = await pool.query<{
    id: string; owner_id: string; visibility: string; workspace_id: string;
    workspace_role: string | null; permission: string | null;
  }>(
    `SELECT r.id, r.owner_id, r.visibility, r.workspace_id,
            wm.role AS workspace_role, rc.permission
       FROM devora.repositories r
       LEFT JOIN devora.workspace_members wm ON wm.workspace_id = r.workspace_id AND wm.user_id = $2
       LEFT JOIN devora.repository_collaborators rc ON rc.repository_id = r.id AND rc.user_id = $2
      WHERE r.id = $1`,
    [repositoryId, userId]
  );
  const repo = result.rows[0];
  if (!repo) throw new AuthError("Repository not found", 404);
  const workspaceAdmin = repo.owner_id === userId || repo.workspace_role === "owner" || repo.workspace_role === "admin";
  const collaborator = repo.permission;
  const canRead = repo.visibility === "public" || workspaceAdmin || Boolean(collaborator);
  const canWrite = workspaceAdmin || ["write", "maintain", "admin"].includes(collaborator ?? "");
  if (mode === "write" ? !canWrite : !canRead) throw new AuthError("Insufficient repository permissions", 403);
  return repo;
}

export async function enforceRateLimit(key: string, maxAttempts: number, windowMinutes: number) {
  const pool = getPool();
  const keyHash = sha256(key);
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO devora.auth_rate_limits(key_hash, window_started_at, attempts)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (key_hash) DO UPDATE SET
       attempts = CASE WHEN devora.auth_rate_limits.window_started_at < NOW() - ($2 * INTERVAL '1 minute') THEN 1 ELSE devora.auth_rate_limits.attempts + 1 END,
       window_started_at = CASE WHEN devora.auth_rate_limits.window_started_at < NOW() - ($2 * INTERVAL '1 minute') THEN NOW() ELSE devora.auth_rate_limits.window_started_at END
     RETURNING attempts`,
    [keyHash, windowMinutes]
  );
  if (result.rows[0].attempts > maxAttempts) throw new AuthError("Too many attempts. Try again later.", 429);
}
