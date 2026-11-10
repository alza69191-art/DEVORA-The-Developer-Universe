import { readFile } from "node:fs/promises";

const checks = [
  ["password hashing", "src/lib/security.ts", /scrypt:/],
  ["constant-time password compare", "src/lib/security.ts", /timingSafeEqual/],
  ["hashed session tokens", "src/lib/auth.ts", /sha256\(token\)/],
  ["httpOnly session cookie", "src/lib/auth.ts", /httpOnly: true/],
  ["same-origin registration", "src/app/api/auth/register/route.ts", /Invalid request origin/],
  ["same-origin login", "src/app/api/auth/login/route.ts", /Invalid request origin/],
  ["verified email required for login", "src/app/api/auth/login/route.ts", /email_verified_at/],
  ["repository write authorization", "src/app/api/repositories/[id]/assets/route.ts", /requireRepositoryAccess\(id,user.id,"write"\)/],
  ["server-only Forgejo token", "src/lib/forgejo.ts", /Authorization: `token ${token}`/],
  ["R2 presigned uploads", "src/lib/r2.ts", /AWS4-HMAC-SHA256/],
  ["Git smart HTTP proxy checks API tokens", "src/app/git/[...path]/route.ts", /requireRepositoryAccess/],
  ["Git proxy enforces write scope", "src/app/git/[...path]/route.ts", /repo:write/]
];
let failed=0;
for (const [label,path,pattern] of checks) {
  const source=await readFile(path,"utf8");
  if(pattern.test(source)) console.log(`PASS ${label}`);
  else { console.error(`FAIL ${label}`); failed++; }
}
if(failed) process.exit(1);
console.log(`Security source checks passed: ${checks.length}`);
