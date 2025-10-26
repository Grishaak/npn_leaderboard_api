import crypto from "node:crypto";
import { redis, allow, cors, sanitizeName, getClientIP, verifyTurnstile } from "./_lib.js";
import { ratelimit } from "./_ratelimit.js";

const ZKEY = "npn:lb:z";

export default async function handler(req, res) {
  const origin = allow(req);
  cors(req, res, origin);                 // ← ставим заголовки СРАЗУ
  if (req.method === "OPTIONS") return res.status(204).end();    // ← preflight OK
  if (req.method !== "POST")   return res.status(405).json({ ok:false, error:"method" });

  try {
    const ip   = getClientIP(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const score = Number(body.score ?? 0) | 0;
    const name  = sanitizeName ? sanitizeName(body.name) : (String(body.name||"").trim().slice(0,10) || "аноним");
    const nonce = body.nonce || "";
    const cfTok = body.cf_token || "";
    const sessionMs = Number(body.session_ms || 0);

    // rate limit по IP
    const { success } = await ratelimit.limit(`${ip}:submit`);
    if (!success) return res.status(429).json({ ok:false, error:"rate" });

    // капча (если секрета нет — можно пропустить в dev)
    if ((process.env.TURNSTILE_SECRET || "").length > 0) {
      const ok = await verifyTurnstile(cfTok, ip);
      if (!ok) return res.status(400).json({ ok:false, error:"captcha" });
    }

    // одноразовый nonce — «сжигаем»
    const nonceData = await redis.getdel(`npn:nonce:${nonce}`);
    if (!nonceData) return res.status(400).json({ ok:false, error:"nonce" });
    const parsed = JSON.parse(nonceData);
    const elapsed = Date.now() - (parsed.ts || 0);

    // sanity checks
    if (!Number.isFinite(score) || score < 0) return res.status(400).json({ ok:false, error:"bad_score" });
    if (elapsed < 12000 || sessionMs < 8000)  return res.status(400).json({ ok:false, error:"too_fast" });
    if (score > 1000000)                      return res.status(400).json({ ok:false, error:"too_high" });

    // запись
    const id = crypto.randomUUID();
    await redis.hset(`npn:lb:entry:${id}`, { name, score, ts: Date.now(), ip });
    await redis.zadd(ZKEY, { score, member: id });

    const total = await redis.zcard(ZKEY);
    if (total > 2000) await redis.zremrangebyrank(ZKEY, 0, total - 2001);

    // ранг
    let rank0;
    if (typeof redis.zrevrank === "function") rank0 = await redis.zrevrank(ZKEY, id);
    else rank0 = await redis.zrank(ZKEY, id, { rev: true });

    return res.status(200).json({ ok:true, rank: (rank0 ?? -1) + 1 });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"server", detail:String(e) });
  }
}
