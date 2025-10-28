export const config = { runtime: "edge" };

import { json, cors, redis } from "./_lib.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return cors(req, new Response(null, { status: 204 }));
  const url = new URL(req.url);
  const n = Math.max(1, Math.min(50, Number(url.searchParams.get("n") || 10)));

  // Upstash Redis v1.28: удобный формат объектов
  const rows = await redis.zrange("npn:lb", 0, n - 1, { rev: true, withScores: true });
  const top = rows.map((row, i) => {
    const data = typeof row.member === "string" ? JSON.parse(row.member) : row.member;
    return { rank: i + 1, name: data.name, score: row.score };
  });

  return cors(req, json(200, { ok:true, data:{ top } }));
}
