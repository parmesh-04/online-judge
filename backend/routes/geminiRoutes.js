const express = require('express');
const router = express.Router();
const geminiController = require('../controller/geminiController');
const { requireAuth } = require('../middleware/auth');

router.post('/analyze', requireAuth(), geminiController.analyzeSubmission);

module.exports = router;
