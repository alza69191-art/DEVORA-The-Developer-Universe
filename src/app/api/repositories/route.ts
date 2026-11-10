import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";
import { createForgejoRepository, deleteForgejoRepository, isForgejoConfigured } from "@/lib/forgejo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await getPool().query(
      `SELECT DISTINCT r.id,r.name,r.slug,r.description,r.visibility,r.default_branch,r.clone_url,r.ssh_url,r.forgejo_html_url,r.created_at
         FROM devora.repositories r
         LEFT JOIN devora.workspace_members wm ON wm.workspace_id=r.workspace_id AND wm.user_id=$1
         LEFT JOIN devora.repository_collaborators rc ON rc.repository_id=r.id AND rc.user_id=$1
        WHERE r.visibility='public' OR r.owner_id=$1 OR rc.user_id IS NOT NULL OR wm.role IN ('owner','admin') OR (r.visibility='internal' AND wm.user_id IS NOT NULL)
        ORDER BY r.created_at DESC LIMIT 100`,[user.id]
    );
    return NextResponse.json({repositories:result.rows});
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({error:error instanceof Error?error.message:"Could not list repositories"},{status});
  }
}

export async function POST(request: NextRequest) {
  let remote: {owner:string;name:string}|null = null;
  try {
    const user = await requireUser();
    const origin = request.headers.get("origin");
    if (!process.env.APP_URL || !origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({error:"Invalid request origin"},{status:403});
    if (!isForgejoConfigured() || !process.env.FORGEJO_OWNER) return NextResponse.json({error:"Git engine is not configured"},{status:503});
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim().slice(0,500);
    const visibility = body.visibility === "public" ? "public" : "private";
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) throw new AuthError("Repository name must use letters, numbers, dot, underscore or hyphen.");
    const pool = getPool();
    const workspace = await pool.query<{id:string}>("SELECT id FROM devora.workspaces WHERE owner_id=$1 ORDER BY created_at LIMIT 1",[user.id]);
    if (!workspace.rowCount) throw new AuthError("Workspace not found",404);
    const slug = name.toLowerCase();
    const existing = await pool.query("SELECT 1 FROM devora.repositories WHERE workspace_id=$1 AND slug=$2",[workspace.rows[0].id,slug]);
    if (existing.rowCount) throw new AuthError("A repository with this name already exists.",409);
    const remoteRepo = await createForgejoRepository({name:`u${user.id.replace(/-/g,"").slice(0,8)}-${slug}`,description,isPrivate:true,autoInit:true});
    remote = {owner:process.env.FORGEJO_OWNER,name:remoteRepo.name};\n    const cloneUrl = new URL(`/git/${encodeURIComponent(process.env.FORGEJO_OWNER)}/${encodeURIComponent(remoteRepo.name)}.git`, process.env.APP_URL).toString();
    const inserted = await pool.query(
      `INSERT INTO devora.repositories(workspace_id,owner_id,name,slug,description,visibility,default_branch,forgejo_repo_id,forgejo_owner,forgejo_name,forgejo_html_url,clone_url,ssh_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,name,slug,description,visibility,default_branch,clone_url,ssh_url,forgejo_html_url,created_at`,
      [workspace.rows[0].id,user.id,name,slug,description,visibility,remoteRepo.default_branch,remoteRepo.id,process.env.FORGEJO_OWNER,remoteRepo.name,remoteRepo.html_url,cloneUrl,null]
    );
    return NextResponse.json({repository:inserted.rows[0]}, {status:201});
  } catch (error) {
    if (remote) { try { await deleteForgejoRepository(remote.owner,remote.name); } catch {} }
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({error:error instanceof Error?error.message:"Could not create repository"},{status});
  }
}
