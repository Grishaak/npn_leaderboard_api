// Edge-friendly утилиты
import { Redis } from "@upstash/redis";

// JSON-ответ
export function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

// CORS-обёртка: эхо-разрешение для допустимых Origins
export function cors(req, res) {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.NPN_ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const okOrigin = !allowed.length || allowed.includes(origin);
  const h = new Headers(res.headers);
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  h.set("access-control-allow-origin", okOrigin ? origin : "null");
  h.set("vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

export function originAllowed(req) {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.NPN_ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return !allowed.length || allowed.includes(origin);
}

export function ip(req) {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || "0.0.0.0";
}

export const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL / _TOKEN
