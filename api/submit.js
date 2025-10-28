export const config = { runtime: "edge" };

import { json, cors, originAllowed, ip, redis } from "./_lib.js";
import { limit } from "./_ratelimit.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  if (req.method !== "POST")   return cors(req, json(405, { ok:false, error:"method" }));
  if (!originAllowed(req))     return cors(req, json(403, { ok:false, error:"origin" }));

  const { success } = await limit(`sub:${ip(req)}`, "submit");
  if (!success) return cors(req, json(429, { ok:false, error:"rate" }));

  // Клиент шлёт text/plain с JSON-строкой
  const raw = await req.text();
  let body;
  try { body = JSON.parse(raw); }
  catch { return cors(req, json(400, { ok:false, error:"bad_json" })); }

  const name = String((body.name ?? "аноним")).slice(0, 10);
  const score = Number(body.score);
  const nonce = body.nonce;
  const session_ms = Number(body.session_ms);

  if (!nonce)                      return cors(req, json(400, { ok:false, error:"bad_nonce" }));
  if (!Number.isFinite(score))     return cors(req, json(400, { ok:false, error:"bad_score" }));
  if (score < 0 || score > (+process.env.NPN_MAX_SCORE || 100000))
                                   return cors(req, json(400, { ok:false, error:"range" }));
  if (!Number.isFinite(session_ms) || session_ms < (+process.env.NPN_MIN_SESSION_MS || 10000))
                                   return cors(req, json(400, { ok:false, error:"too_fast" }));

  const key = `npn:nonce:${nonce}`;
  const state = await redis.get(key);
  if (state !== "issued")          return cors(req, json(400, { ok:false, error:"nonce_state" }));

  await redis.set(key, "used", { ex: 600 });

  // запись в ZSET
  await redis.zadd("npn:lb", { score, member: JSON.stringify({ name, score, ts: Date.now() }) });

  return cors(req, json(200, { ok:true }));
}
