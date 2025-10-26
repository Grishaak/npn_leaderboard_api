import { redis, allow, cors } from "./_lib.js";
const ZKEY = "npn:lb:z";

export default async function handler(req, res) {
  const origin = allow(req);
  cors(req, res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const n = Math.max(1, Math.min(50, Number(req.query?.n || 10)));
    const limit = n * 5, end = Math.max(0, limit - 1);
    const ids = await redis.zrange(ZKEY, 0, end, { rev: true });

    if (!ids || ids.length === 0) return res.status(200).json({ ok:true, top: [] });

    const entries = (await Promise.all(ids.map(async (id) => {
      const h = await redis.hgetall(`npn:lb:entry:${id}`);
      if (!h) return null;
      return { id, name: String(h.name || "аноним"), score: Number(h.score||0), ts: Number(h.ts||0) };
    }))).filter(Boolean);

    if (entries.length === 0) return res.status(200).json({ ok:true, top: [] });

    entries.sort((a,b) => (b.score - a.score) || (a.ts - b.ts));
    const top = entries.slice(0, n).map((e, i) => ({ rank: i+1, name: e.name, score: e.score, ts: e.ts }));

    return res.status(200).json({ ok:true, top });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"server", detail:String(e) });
  }
}
