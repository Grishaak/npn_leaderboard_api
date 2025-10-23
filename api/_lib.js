// api/_lib.js
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv(); // читает UPSTASH_REDIS_REST_URL/TOKEN

const ALLOWED = [
  "https://grishaak.github.io/NPN-game/" // ← ПОСТАВЬ точный origin твоей игры
];

export function allow(req) {
  const o = req.headers.origin || "";
  return ALLOWED.includes(o) ? o : ALLOWED[0];
}

export function cors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

export function sanitizeName(raw) {
  let s = (raw || "").trim();
  // разрешим только буквы (латиница/кириллица) и пробелы, макс 10 символов
  s = s.replace(/[^A-Za-z\u0400-\u04FF\s]/g, "").slice(0, 10);
  // если не ввёл ничего — "аноним"
  return s || "аноним";
}


