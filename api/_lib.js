import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// Только ОРИДЖИНЫ (без пути и без слеша на конце!)
const ALLOWED = [
  "https://grishaak.github.io",
  // "http://localhost:5173", // если нужно для локала
  // "http://localhost:5500",
];

export function allow(req) {
  const o = req.headers.origin || "";
  return ALLOWED.includes(o) ? o : ALLOWED[0];
}

export function cors(req, res, origin) {
  const reqHdr = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", reqHdr || "content-type");
}

// Утилиты, если нужны
export function getClientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  return Array.isArray(xff) ? xff[0] : (xff || "").split(",")[0].trim();
}
