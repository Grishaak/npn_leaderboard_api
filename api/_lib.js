// api/_lib.js
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv(); // читает UPSTASH_REDIS_REST_URL/TOKEN

const ALLOWED = [
  "https://grishaak.github.io" // ← ПОСТАВЬ точный origin твоей игры
];

export function allow(req) {
  const o = req.headers.origin || "";
  return ALLOWED.includes(o) ? o : ALLOWED[0];
}

export function cors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

export function sanitizeName(raw) {
  let s = (raw || "").trim();
  // разрешим только буквы (латиница/кириллица) и пробелы, макс 10 символов
  s = s.replace(/[^A-Za-z\u0400-\u04FF\s]/g, "").slice(0, 10);
  // если не ввёл ничего — "аноним"
  return s || "аноним";
}

export function getClientIP(req) {
  // На Vercel X-Forwarded-For — официальный способ; они фильтруют спуфинг. :contentReference[oaicite:4]{index=4}
  const xff = req.headers["x-forwarded-for"];
  return Array.isArray(xff) ? xff[0] : (xff || "").split(",")[0].trim();
}

export async function verifyTurnstile(token, ip) {
  if (!token) return false;
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
}