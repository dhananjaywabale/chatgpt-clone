const buckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

function rateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS) {
    res.set("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }
  return next();
}

module.exports = { rateLimit };