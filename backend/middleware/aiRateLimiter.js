// Purpose: In-memory sliding window rate limiter for AI endpoints.
// Limits each user to a configurable number of requests per minute.
// No Redis needed — uses a simple Map with automatic cleanup.

const AI_RATE_LIMIT = 10; // max requests per user per minute
const WINDOW_MS = 60 * 1000; // 1 minute

// Map<userId, Array<timestamp>>
const requestLog = new Map();

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of requestLog.entries()) {
    const filtered = timestamps.filter((t) => now - t < WINDOW_MS);
    if (filtered.length === 0) {
      requestLog.delete(userId);
    } else {
      requestLog.set(userId, filtered);
    }
  }
}, 5 * 60 * 1000);

const aiRateLimiter = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const now = Date.now();
  const timestamps = requestLog.get(userId) || [];

  // Remove timestamps outside the sliding window
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= AI_RATE_LIMIT) {
    return res.status(429).json({
      error: 'AI rate limit exceeded. Please wait before making more AI requests.',
      retryAfterMs: WINDOW_MS - (now - recent[0]),
    });
  }

  recent.push(now);
  requestLog.set(userId, recent);
  next();
};

module.exports = aiRateLimiter;
