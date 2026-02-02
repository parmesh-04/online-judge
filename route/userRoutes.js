const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const { requireAuth } = require('../middleware/auth');

router.get('/stats', requireAuth(), userController.getUserStats);
router.get('/public/:userId', userController.getPublicProfile);
router.get('/leaderboard', userController.getLeaderboard);

module.exports = router;
