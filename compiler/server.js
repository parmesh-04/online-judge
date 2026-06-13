// ═══════════════════════════════════════════════════════════════════════
// compiler/server.js — Compiler microservice Express server
// ═══════════════════════════════════════════════════════════════════════
//
// This is a standalone Express server that handles code execution.
// It runs as a separate service (different port than the main backend)
// because code execution is resource-intensive and should be isolated.
//
// Endpoints:
//   POST /compiler/run    — Execute code with custom input (playground mode)
//   POST /compiler/submit — Judge code against hidden test cases
//
// Dependencies:
//   - Docker must be installed and accessible (via /var/run/docker.sock)
//   - MAIN_BACKEND_API_URL must point to the main backend for verdict reporting
//
// Port: 8000 (configurable via PORT env var)
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config();

// ── Validate required environment variables on startup ──
// MAIN_BACKEND_API_URL is required so the compiler can report verdicts
// back to the backend after judging submissions.
const REQUIRED_ENV = ['MAIN_BACKEND_API_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { verifyDocker } = require('./utils/dockerExecutor');
const compilerController = require('./controller/compilerController');

const app = express();

// ── CORS: Allow the frontend to send code execution requests ──
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,  // Allow cookies to be forwarded (needed for auth)
}));

// ── Cookie parser: Read the user's auth cookie for verdict reporting ──
app.use(cookieParser());

// ── JSON body parser: Parse the code submission body ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check / root route ──
app.get('/', (req, res) => {
  res.send('compiler service running');
});

// ── Routes ──
// POST /compiler/run: Execute code in playground mode (user-provided input)
app.post('/compiler/run', compilerController.runCode);
// POST /compiler/submit: Judge code against hidden test cases
app.post('/compiler/submit', compilerController.submitCode);

// ── Export for testing ──
module.exports = app;

// ── Start server when run directly ──
if (require.main === module) {
  (async () => {
    // Verify Docker is available before accepting any requests.
    // If Docker isn't running, exit immediately with a clear error message
    // rather than failing silently on the first code execution.
    await verifyDocker();

    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => console.log(`🚀 Compiler running on port ${PORT}`));
  })();
}