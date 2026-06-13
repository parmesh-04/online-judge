// ═══════════════════════════════════════════════════════════════════════
// backend/server.js — Main Express server for the Online Judge backend API
// ═══════════════════════════════════════════════════════════════════════
//
// This is the entry point of the backend service. It:
// 1. Loads environment variables from .env via dotenv
// 2. Validates required env vars (MONGO_URI, JWT_SECRET, GEMINI_API_KEY)
// 3. Applies middleware in strict order:
//    helmet (security headers) → CORS → morgan (logging) →
//    cookie-parser → JSON body parser → rate limiters → routes → error handler
//
// WHY THIS ORDER MATTERS:
// - Helmet MUST be first so security headers are set before any response
// - CORS MUST come before routes so preflight requests are handled
// - Morgan logs all requests so it goes before routes
// - Error handler MUST be last — Express only calls 4-argument middleware
//   (err, req, res, next) when next(error) is called from a route
//
// Port: 5000 (configurable via PORT env var)
// ═══════════════════════════════════════════════════════════════════════

// Load .env file ONLY in development.
// In production (Docker) and CI (test), env vars are injected directly by the
// container runtime / GitHub Actions — we must NOT override them with a local .env file.
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

// ── Validate required environment variables on startup ──
// If any are missing, log clearly and exit — never start with broken config.
// This prevents cryptic runtime errors like "jwt secret undefined" or
// "MongooseError: unable to connect to undefined".
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { DBConnection } = require('./config/database.js');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── 1. Security Headers ──
// helmet() sets various HTTP headers for security:
//   X-Content-Type-Options: nosniff (prevents MIME type sniffing)
//   X-Frame-Options: DENY (prevents clickjacking)
//   X-XSS-Protection: 1; mode=block (legacy XSS filter)
// contentSecurityPolicy disabled because Monaco Editor needs inline scripts.
app.use(helmet({
  contentSecurityPolicy: false,
}));

// ── 2. CORS Configuration ──
// Must come BEFORE routes so preflight OPTIONS requests are handled correctly.
// credentials: true allows the browser to send HttpOnly cookies (JWT auth).
// origin must be an exact match — no wildcards when credentials are enabled.
const allowedOrigin = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// ── 3. Request Logging ──
// In production: write Apache-style combined logs to logs/access.log for analysis.
// In development: use colorized 'dev' format to stdout for quick debugging.
if (process.env.NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }  // append mode — don't overwrite old logs
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// ── 4. Standard Body Parsing Middleware ──
// cookieParser: parses Cookie header into req.cookies (needed for JWT auth)
// express.json: parses JSON request bodies (limit 1mb to prevent abuse)
// express.urlencoded: parses form-encoded bodies (for compatibility)
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 5. Rate Limiting ──
// Three tiers of rate limiting protect against brute-force and abuse.
// All limiters use a sliding window per IP address.

// General API limit: 100 requests per 15 minutes per IP
// Generous enough for normal browsing, blocks automated scrapers.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,     // Return RateLimit-* headers
  legacyHeaders: false,      // Don't return X-RateLimit-* headers
  message: { error: 'Too many requests, please try again later.' },
});

// Auth limiter is defined per-route in authRoutes.js (not applied globally here)
// so that logout is NOT rate-limited. See routes/authRoutes.js for details.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// AI routes: 20 requests per 15 minutes per IP
// Gemini API has its own quota — this prevents a single user from exhausting it.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please try again later.' },
});

// Apply general limiter to all /api/ routes
app.use('/api/', generalLimiter);

// ── 6. Database Initialization ──
// Lazy initialization pattern: DB connects on first request.
// This allows the server to start even if MongoDB is temporarily unavailable,
// and it will auto-connect when MongoDB becomes reachable.
let dbInitialized = false;
const initializeDB = async () => {
  if (!dbInitialized) {
    try {
      await DBConnection();
      dbInitialized = true;
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }
};

// Middleware to ensure DB is ready before any route is hit.
// This runs on every request but only actually connects once.
app.use(async (req, res, next) => {
  await initializeDB();
  next();
});

// ── 7. Routes ──
// Mount order doesn't matter for Express Router — path matching is by prefix.
// Each route file exports an Express Router with its own sub-routes.
app.get('/', (req, res) => {
  res.send('CodeArena Backend API is running');
});

app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));              // rate limited per-route inside
app.use('/api/problems', require('./routes/problemRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/gemini', require('./routes/geminiRoutes'));
app.use('/api/submission', require('./routes/submissionRoutes'));
app.use('/api/ai', aiLimiter, require('./routes/aiRoutes'));       // AI-specific rate limiter

// ── 8. Global Error Handler (MUST be LAST middleware) ──
// Express identifies error handlers by their 4-argument signature:
// (err, req, res, next). If this is mounted before routes, it won't
// catch errors thrown in those routes.
app.use(errorHandler);

// ── 9. Exports ──
// The app is exported so it can be used in tests or Docker.
// When run directly (node server.js), it starts listening.
module.exports = app;

// Local Development Server
if (require.main === module) {
  (async () => {
    await DBConnection();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Backend running locally on port ${PORT}`));
  })();
}