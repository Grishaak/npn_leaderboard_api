// api/_lib.js
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// Разрешённые origin'ы (ТОЛЬКО origin, без пути и слеша)
const ALLOWED = [
  "https://grishaak.github.io",
  // "http://localhost:5173", // если тестируешь локально
  // "http://localhost:5500",
];

export function allow(req) {
  const o = req.headers.origin || "";
  return ALLOWED.includes(o) ? o : ALLOWED[0];
}

// ВАЖНО: отражаем запрошенные заголовки из preflight
export function cors(req, res, origin) {
  const reqHdr = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", reqHdr || "content-type");
}

export function getClientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  return Array.isArray(xff) ? xff[0] : (xff || "").split(",")[0].trim();
}

export function sanitizeName(raw) {
  let s = (raw || "").trim().replace(/[^A-Za-z\u0400-\u04FF\s]/g, "").slice(0, 10);
  return s || "аноним";
}

// Нужен для health-чеки и понятных 500-ошибок
export function ensureEnv() {
  const miss = [];
  if (!process.env.UPSTASH_REDIS_REST_URL) miss.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) miss.push("UPSTASH_REDIS_REST_TOKEN");
  return miss;
}

// Валидация Cloudflare Turnstile на сервере (submit)
export async function verifyTurnstile(token, ip) {
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET || "",
        response: token,
        remoteip: ip || "",
      }),
    });
    const data = await r.json();
    return !!data.success;
  } catch {
    return false;
  }
}
