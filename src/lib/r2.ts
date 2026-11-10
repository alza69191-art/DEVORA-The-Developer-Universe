import { createHash, createHmac } from "node:crypto";

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}
function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
function r2Config() {
  const account = process.env.R2_ACCOUNT_ID;
  const access = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!account || !access || !secret || !bucket) throw new Error("R2 storage is not configured");
  return { account, access, secret, bucket };
}
export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function signR2Object(method: "PUT" | "GET" | "HEAD", key: string, contentType?: string, expiresSeconds = 300) {
  const { account, access, secret, bucket } = r2Config();
  const region = "auto";
  const service = "s3";
  const host = `${account}.r2.cloudflarestorage.com`;
  const path = `/${awsEncode(bucket)}/${key.split("/").map(awsEncode).join("/")}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const params: Record<string,string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${access}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host"
  };
  const canonicalQuery = Object.entries(params).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${awsEncode(k)}=${awsEncode(v)}`).join("&");
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const query = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return { url: `https://${host}${path}?${query}`, headers: contentType ? { "Content-Type": contentType } : {} };
}
