import crypto from "node:crypto";
import { redis, allow, cors, getClientIP } from "./_lib.js";
import { ratelimit } from "./_ratelimit.js";

export default async function handler(req, res) {
  const origin = allow(req);
  cors(req, res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  try {
    const ip = getClientIP(req);
    const { success } = await ratelimit.limit(`${ip}:challenge`);
    if (!success) return res.status(429).json({ ok: false, error: "rate" });

    const id = crypto.randomUUID();
    const now = Date.now();
    await redis.set(`npn:nonce:${id}`, JSON.stringify({ ip, ts: now }), { ex: 600 });

    return res.status(200).json({ ok: true, nonce: id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server", detail: String(e) });
  }
}
