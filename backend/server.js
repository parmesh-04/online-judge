// backend/server.js
// Main Express server for the Online Judge backend.
// Middleware order: helmet -> cors -> morgan -> body parsers -> rate limiters -> routes -> error handler

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

// Fail fast if required env vars are missing
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
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

// Security headers — contentSecurityPolicy disabled because Monaco Editor needs inline scripts
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — must come before routes so preflight OPTIONS requests are handled
const allowedOrigin = process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Request logging
if (process.env.NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — general API, auth, and AI routes have separate limits
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please try again later.' },
});

app.use('/api/', generalLimiter);

// Connect to DB on first request and reuse the connection after that
let dbInitialized = false;
const initializeDB = async () => {
  if (!dbInitialized) {
    try {
      await DBConnection();
      dbInitialized = true;
      console.log('Database connected');
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  }
};

app.use(async (req, res, next) => {
  await initializeDB();
  next();
});

// Routes
app.get('/', (req, res) => {
  res.send('CodeArena Backend API is running');
});

app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/problems', require('./routes/problemRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/gemini', require('./routes/geminiRoutes'));
app.use('/api/submission', require('./routes/submissionRoutes'));
app.use('/api/ai', aiLimiter, require('./routes/aiRoutes'));

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  (async () => {
    await DBConnection();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })();
}