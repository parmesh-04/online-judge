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
 *
 * IMPORTANT: secure:true requires HTTPS. Set COOKIE_SECURE=true in .env
 * ONLY after configuring SSL/TLS (Stage 8 — certbot). Until then, leave
 * it unset (defaults to false) so cookies work over plain HTTP on EC2.
 */
const setAuthCookie = (res, token) => {
  const isHttps = process.env.COOKIE_SECURE === 'true';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
};

module.exports = { createToken, setAuthCookie };