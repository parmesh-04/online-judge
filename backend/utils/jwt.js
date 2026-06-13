// backend/utils/jwt.js
// JWT creation and cookie helpers — reused by register and login.

const jwt = require('jsonwebtoken');

/**
 * Creates a signed JWT containing basic user info (no password).
 */
const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Sets the JWT as an HttpOnly cookie on the response.
 * HttpOnly prevents JS from reading the token (XSS protection).
 * secure + sameSite are tightened in production.
 */
const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
};

module.exports = { createToken, setAuthCookie };