export const config = { runtime: "edge" };
import { json, cors } from "./_lib.js";
export default function handler(req) {
  return cors(req, json(200, { ok:true, ts: Date.now() }));
}
