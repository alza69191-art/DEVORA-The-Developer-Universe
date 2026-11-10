import { NextRequest,NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUser, requireRepositoryAccess, AuthError } from "@/lib/auth";
import { getForgejoRepository, getForgejoGitTree, listForgejoBranches, updateForgejoRepository, deleteForgejoRepository } from "@/lib/forgejo";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();const {id}=await context.params;
  await requireRepositoryAccess(id,user.id,"read");
  const pool=getPool();
  const result=await pool.query(
   `SELECT r.id,r.name,r.slug,r.description,r.visibility,r.default_branch,r.forgejo_owner,r.forgejo_name,r.clone_url,r.ssh_url,r.forgejo_html_url,r.created_at,u.username
    FROM devora.repositories r JOIN devora.users u ON u.id=r.owner_id WHERE r.id=$1`,[id]);
  if(!result.rowCount)throw new AuthError("Repository not found",404);
  const permissions=await pool.query<{owner_id:string;workspace_role:string|null;permission:string|null}>(
   `SELECT r.owner_id,wm.role AS workspace_role,rc.permission FROM devora.repositories r
    LEFT JOIN devora.workspace_members wm ON wm.workspace_id=r.workspace_id AND wm.user_id=$2
    LEFT JOIN devora.repository_collaborators rc ON rc.repository_id=r.id AND rc.user_id=$2 WHERE r.id=$1`,[id,user.id]);
  const p=permissions.rows[0];
  const canAdmin=p.owner_id===user.id||["owner","admin"].includes(p.workspace_role??"")||p.permission==="admin";
  const repo=result.rows[0] as {forgejo_owner:string;forgejo_name:string};
  const remote=await getForgejoRepository(repo.forgejo_owner,repo.forgejo_name);
  const [branches,tree]=await Promise.all([
   listForgejoBranches(repo.forgejo_owner,repo.forgejo_name),
   getForgejoGitTree(repo.forgejo_owner,repo.forgejo_name,remote.default_branch)
  ]);
  return NextResponse.json({repository:{...result.rows[0],canAdmin},git:{defaultBranch:remote.default_branch,branches,tree:tree.tree}});
 }catch(error){const status=error instanceof AuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Could not load repository"},{status});}
}
export async function PATCH(request:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();const origin=request.headers.get("origin");
  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  const {id}=await context.params;await requireRepositoryAccess(id,user.id,"write");
  const pool=getPool();const access=await pool.query<{owner_id:string;workspace_role:string|null;permission:string|null;forgejo_owner:string;forgejo_name:string}>(
   `SELECT r.owner_id,r.forgejo_owner,r.forgejo_name,wm.role AS workspace_role,rc.permission FROM devora.repositories r
    LEFT JOIN devora.workspace_members wm ON wm.workspace_id=r.workspace_id AND wm.user_id=$2
    LEFT JOIN devora.repository_collaborators rc ON rc.repository_id=r.id AND rc.user_id=$2 WHERE r.id=$1`,[id,user.id]);
  const a=access.rows[0];if(!a)throw new AuthError("Repository not found",404);
  if(a.owner_id!==user.id&&!["owner","admin"].includes(a.workspace_role??"")&&a.permission!=="admin")throw new AuthError("Repository administrator permission required",403);
  const body=await request.json();const description=String(body.description??"").slice(0,500);const visibility=body.visibility==="public"?"public":"private";
  await updateForgejoRepository(a.forgejo_owner,a.forgejo_name,{private:true,description});
  const updated=await pool.query("UPDATE devora.repositories SET description=$1,visibility=$2,updated_at=NOW() WHERE id=$3 RETURNING id,name,description,visibility,default_branch,clone_url,ssh_url",[description,visibility,id]);
  return NextResponse.json({repository:updated.rows[0]});
 }catch(error){const status=error instanceof AuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Could not update repository"},{status});}
}
export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();const origin=request.headers.get("origin");
  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  const {id}=await context.params;const pool=getPool();
  const access=await pool.query<{owner_id:string;workspace_role:string|null;permission:string|null;forgejo_owner:string;forgejo_name:string}>(
   `SELECT r.owner_id,r.forgejo_owner,r.forgejo_name,wm.role AS workspace_role,rc.permission FROM devora.repositories r
    LEFT JOIN devora.workspace_members wm ON wm.workspace_id=r.workspace_id AND wm.user_id=$2
    LEFT JOIN devora.repository_collaborators rc ON rc.repository_id=r.id AND rc.user_id=$2 WHERE r.id=$1`,[id,user.id]);
  const a=access.rows[0];if(!a)throw new AuthError("Repository not found",404);
  if(a.owner_id!==user.id&&!["owner","admin"].includes(a.workspace_role??"")&&a.permission!=="admin")throw new AuthError("Repository administrator permission required",403);
  await deleteForgejoRepository(a.forgejo_owner,a.forgejo_name);
  await pool.query("DELETE FROM devora.repositories WHERE id=$1",[id]);
  return NextResponse.json({ok:true});
 }catch(error){const status=error instanceof AuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Could not delete repository"},{status});}
}
