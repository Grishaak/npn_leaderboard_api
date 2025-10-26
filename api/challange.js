// api/challenge.js
import crypto from "node:crypto";
import { redis, allow, cors, getClientIP } from "./_lib.js";
import { ratelimit } from "./_ratelimit.js";

export default async function handler(req, res) {
    const origin = allow(req);
    if (req.method === "OPTIONS") { cors(res, origin); return res.status(204).end(); }
    if (req.method !== "POST") { return res.status(405).end(); }

    const ip = getClientIP(req);

    // простейший rate-limit на выдачу челленджа
    const { success } = await ratelimit.limit(`${ip}:challenge`);
    if (!success) { cors(res, origin); return res.status(429).json({ ok: false, error: "rate" }); }

    const id = crypto.randomUUID();
    const now = Date.now();

    // Сохраняем nonce с TTL (10 минут)
    await redis.set(`npn:nonce:${id}`, JSON.stringify({ ip, ts: now }), { ex: 600 });

    cors(res, origin);
    return res.status(200).json({ ok: true, nonce: id });
}
