export async function sendAccountEmail(input: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Email delivery is not configured (RESEND_API_KEY and EMAIL_FROM)");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Email provider rejected request: ${response.status}`);
}

export async function sendActionLink(to: string, url: string, purpose: "verify" | "reset") {
  const isVerify = purpose === "verify";
  const title = isVerify ? "Verify your DEVORA email" : "Reset your DEVORA password";
  const action = isVerify ? "Verify email" : "Reset password";
  await sendAccountEmail({
    to, subject: title,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#182033"><h2>${title}</h2><p>${isVerify ? "Confirm your email address to activate your DEVORA account." : "Use the secure link below to choose a new password."}</p><p><a href="${url}" style="display:inline-block;background:#6558d3;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${action}</a></p><p>This link expires in ${isVerify ? "24 hours" : "30 minutes"}. If you did not request this, ignore this message.</p></div>`
  });
}
