import crypto from "node:crypto";
import { redis, allow, cors, getClientIP, ensureEnv } from "./_lib.js";
import { ratelimit } from "./_ratelimit.js";

export default async function handler(req, res) {
  const origin = allow(req);
  cors(req, res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).json({ ok:false, error:"method" });

  const missing = ensureEnv();
  if (missing.length) {
    return res.status(500).json({ ok:false, error:"env", missing });
  }

  try {
    const ip = getClientIP(req);
    try {
      const { success } = await ratelimit.limit(`${ip}:challenge`);
      if (!success) return res.status(429).json({ ok:false, error:"rate" });
    } catch (e) {
      console.error("ratelimit error:", e?.message || e);
    }

    const id  = crypto.randomUUID();
    const now = Date.now();
    await redis.set(`npn:nonce:${id}`, JSON.stringify({ ip, ts: now }), { ex: 600 });

    return res.status(200).json({ ok:true, nonce: id });
  } catch (e) {
    console.error("challenge error:", e?.message || e);
    return res.status(500).json({ ok:false, error:"server", detail: String(e) });
  }
}
