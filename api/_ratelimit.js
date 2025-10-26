import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  // напр., не чаще 5 сабмитов в 1 минуту с одного IP
  limiter: Ratelimit.slidingWindow(5, "1 m"),
});