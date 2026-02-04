require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const { DBConnection } = require("./config/database.js");
const cors = require('cors');

const app = express();

// --- 1. CORS Configuration ---
// Industry Standard: Dynamic origin checking with credentials support
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
   credentials: true }));

// --- 2. Standard Middleware ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 3. Database Initialization ---
// First Principle: Singleton Connection
// Ensures we don't create thousands of connections in a Lambda environment
let dbInitialized = false;
const initializeDB = async () => {
  if (!dbInitialized) {
    try {
      await DBConnection();
      dbInitialized = true;
      console.log("✅ Database connection established");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
    }
  }
};

// Middleware to ensure DB is ready before any route is hit
app.use(async (req, res, next) => {
  await initializeDB();
  next();
});

// --- 4. Routes ---
// These are "Pure" routes. They don't know about '/backend' 
// because AWS API Gateway (Stage) will strip that prefix for us.
app.get('/', (req, res) => {
    res.send("hello world is coming from backend");
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/problems', require('./routes/problemRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/gemini', require('./routes/geminiRoutes'));
app.use('/api/submission', require('./routes/submissionRoutes'));

// --- 5. Exports ---
module.exports = app;

// Local Development Server
if (require.main === module) {
  (async () => {
      await DBConnection();
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`🚀 Backend running locally on port ${PORT}`));
  })();
}