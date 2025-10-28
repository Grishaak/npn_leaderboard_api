export const config = { runtime: "edge" };

import { json, cors, originAllowed, ip, redis } from "./_lib.js";
import { limit } from "./_ratelimit.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  if (req.method !== "POST")   return cors(req, json(405, { ok:false, error:"method" }));
  if (!originAllowed(req))     return cors(req, json(403, { ok:false, error:"origin" }));

  const { success } = await limit(`chal:${ip(req)}`, "chal");
  if (!success) return cors(req, json(429, { ok:false, error:"rate" }));

  const nonce = crypto.randomUUID();
  await redis.set(`npn:nonce:${nonce}`, "issued", { ex: 120 }); // 2 минуты
  return cors(req, json(200, { ok:true, data:{ nonce } }));
}
