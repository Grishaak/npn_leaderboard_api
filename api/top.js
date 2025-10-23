// api/top.js
import { redis, allow, cors } from "./_lib.js";

const ZKEY = "npn:lb:z";

export default async function handler(req, res) {
  const origin = allow(req);
  // CORS preflight
  if (req.method === "OPTIONS") { cors(res, origin); return res.status(204).end(); }

  try {
    const n = Math.max(1, Math.min(50, Number(req.query?.n || 10)));

    // Берём "запас" (например, 5×N), чтобы корректно разрулить тай-брейк локально
    const ids = await redis.zrevrange(ZKEY, 0, n * 5); // айдишники по очкам
    // для каждого — достаём HASH
    const entries = (await Promise.all(
      ids.map(async (id) => {
        const h = await redis.hgetall(`npn:lb:entry:${id}`);
        if (!h) return null;
        return {
          id,
          name: String(h.name || "аноним"),
          score: Number(h.score || 0),
          ts: Number(h.ts || 0)
        };
      })
    )).filter(Boolean);

    // Тай-брейк: score DESC, ts ASC
    entries.sort((a, b) => (b.score - a.score) || (a.ts - b.ts));

    // Формируем ранги (1-based) и режем до N
    const top = entries.slice(0, n).map((e, i) => ({
      rank: i + 1, name: e.name, score: e.score, ts: e.ts
    }));

    cors(res, origin);
    return res.status(200).json({ ok:true, top });
  } catch (e) {
    cors(res, origin);
    return res.status(500).json({ ok:false, error:"server", detail:String(e) });
  }
}
