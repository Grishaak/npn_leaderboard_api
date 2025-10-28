import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./_lib.js";

const perMin = (n) => Ratelimit.slidingWindow(n, "1 m");

const rlSubmit = new Ratelimit({ redis, limiter: perMin(+process.env.NPN_RATE_SUBMIT_PER_MIN || 6) });
const rlChal   = new Ratelimit({ redis, limiter: perMin(+process.env.NPN_RATE_CHAL_PER_MIN   || 12) });

export async function limit(key, kind = "chal") {
  const r = kind === "submit" ? rlSubmit : rlChal;
  return r.limit(key);
}
