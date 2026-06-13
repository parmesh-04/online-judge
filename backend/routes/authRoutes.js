const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controller/authController');

// Rate limiter applied only to login/register, NOT logout
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

router.post('/register', authLimiter, authController.register);
router.post('/login',    authLimiter, authController.login);
router.post('/logout',               authController.logout); // no rate limit on logout

module.exports = router;
