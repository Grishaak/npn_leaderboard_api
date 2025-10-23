// api/submit.js
import { redis, allow, cors, sanitizeName } from "./_lib.js";
import crypto from "node:crypto";

const ZKEY = "npn:lb:z"; // отсортированный набор с айдишниками записей

export default async function handler(req, res) {
    const origin = allow(req);

    // CORS preflight
    if (req.method === "OPTIONS") { cors(res, origin); return res.status(204).end(); }
    if (req.method !== "POST") { return res.status(405).end(); }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const score = Number(body?.score ?? 0) | 0;
        const name = sanitizeName(body?.name);

        if (!Number.isFinite(score) || score < 0) {
            cors(res, origin); return res.status(400).json({ ok: false, error: "bad_score" });
        }

        const ts = Date.now();
        const id = crypto.randomUUID();

        // 1) Сохраняем запись в HASH
        await redis.hset(`npn:lb:entry:${id}`, { name, score, ts });

        // 2) В ZSET — ключ для сортировки по очкам
        await redis.zadd(ZKEY, { score, member: id }); // сортировка по очкам
        // (тай-брейк "кто раньше" сделаем при выборке — см. /api/top)

        // 3) Подрезаем хвост (держим не более 1000)
        const total = await redis.zcard(ZKEY);
        if (total > 1000) {
            // удалить самые низкие: с 0-го по (total-1001) индекс
            await redis.zremrangebyrank(ZKEY, 0, total - 1001);
        }

        // Ранг (0-based) → +1
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
