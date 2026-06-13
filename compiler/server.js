// compiler/server.js
// Standalone Express service for code execution.
// Runs on a separate port from the backend because execution is resource-intensive.
// Requires Docker to be running — exits on startup if Docker is unavailable.

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

if (!process.env.MAIN_BACKEND_API_URL) {
  console.error('Missing required env var: MAIN_BACKEND_API_URL');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { verifyDocker } = require('./utils/dockerExecutor');
const compilerController = require('./controller/compilerController');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('compiler service running');
});

app.post('/compiler/run', compilerController.runCode);
app.post('/compiler/submit', compilerController.submitCode);

module.exports = app;

if (require.main === module) {
  (async () => {
    await verifyDocker();
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => console.log(`Compiler running on port ${PORT}`));
  })();
}