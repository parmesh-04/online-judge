// Purpose: AI feature routes — debug, hint, complexity.
// All routes require authentication and per-user rate limiting.

const express = require('express');
const router = express.Router();
const aiController = require('../controller/aiController');
const { requireAuth } = require('../middleware/auth');
const aiRateLimiter = require('../middleware/aiRateLimiter');

// All AI routes require auth + per-user rate limiting
router.use(requireAuth());
router.use(aiRateLimiter);

router.post('/debug', aiController.debug);
router.post('/hint', aiController.hint);
router.post('/complexity', aiController.complexity);

module.exports = router;
