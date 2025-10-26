// api/submit.js
import { redis, allow, cors, sanitizeName, getClientIP, verifyTurnstile } from "./_lib.js";
import { ratelimit } from "./_ratelimit.js";
import crypto from "node:crypto";

const ZKEY = "npn:lb:z"; // отсортированный набор с айдишниками записей

export default async function handler(req, res) {

    const origin = allow(req);
    cors(res, origin);

    // CORS preflight
    if (req.method === "OPTIONS") { cors(res, origin); return res.status(204).end(); }
    if (req.method !== "POST") { return res.status(405).end(); }

    try {
        const ip = getClientIP(req);

        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

        const rawName = body?.name ?? "";
        const score = Number(body?.score ?? 0) | 0;
        const name = sanitizeName(body?.name);
        const nonce = body?.nonce || "";
        const cfTok = body?.cf_token || "";
        const sessionMs = Number(body?.session_ms || 0);

        const { success } = await ratelimit.limit(`${ip}:submit`);
        if (!success) { cors(res, origin); return res.status(429).json({ ok: false, error: "rate" }); }

        // 1) Проверка капчи (обязательно!)
        const passed = await verifyTurnstile(cfTok, ip);
        if (!passed) { cors(res, origin); return res.status(400).json({ ok: false, error: "captcha" }); }
        // (Server-side проверка обязательна — токены одноразовые/истекают через ~5мин.) :contentReference[oaicite:6]{index=6}

        // 2) Атомарно «сожжём» nonce (иначе его можно переиспользовать)
        // GETDEL поддерживается (Redis 6.2 / Upstash). :contentReference[oaicite:7]{index=7}
        const nonceData = await redis.getdel(`npn:nonce:${nonce}`);
        if (!nonceData) { cors(res, origin); return res.status(400).json({ ok: false, error: "nonce" }); }
        const parsed = JSON.parse(nonceData);
        const elapsed = Date.now() - (parsed.ts || 0);

        if (!Number.isFinite(score) || score < 0) {
            cors(res, origin); return res.status(400).json({ ok: false, error: "bad_score" });
        }

        if (elapsed < 12000 || sessionMs < 8000) {
            cors(res, origin); return res.status(400).json({ ok: false, error: "too_fast" });
        }

        if (score > 100000) {
            cors(res, origin); return res.status(400).json({ ok: false, error: "too_high" });
        }

        const ts = Date.now();
        const id = crypto.randomUUID();

        await redis.hset(`npn:lb:entry:${id}`, { name, score, ts });
        await redis.zadd(ZKEY, { score, member: id }); // сортировка по очкам
        const total = await redis.zcard(ZKEY);
        if (total > 1000) {
            await redis.zremrangebyrank(ZKEY, 0, total - 1001);
        }

        let rank0;
        if (typeof redis.zrevrank === "function") {
            rank0 = await redis.zrevrank(ZKEY, id);
        } else {
            rank0 = await redis.zrank(ZKEY, id, { rev: true });
        }
        cors(res, origin);
        return res.status(200).json({ ok: true, rank: (rank0 ?? -1) + 1 });
    } catch (e) {
        cors(res, origin);
        return res.status(500).json({ ok: false, error: "server", detail: String(e) });
    }
}
