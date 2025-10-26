
import { allow, cors, ensureEnv } from "./_lib.js";

export default async function handler(req, res) {
  const origin = allow(req);
  cors(req, res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  const missing = ensureEnv();
  return res.status(200).json({ ok: missing.length === 0, missing });
}
