// Utility helpers related to JWT and auth cookies.
// These are reused by both register + login (and anywhere else we need them)

const jwt = require('jsonwebtoken');

/**
 * Create a signed JWT token containing basic user info.
 * We DO NOT store the password or sensitive fields inside the token.
 */
const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,   // Must be set — validated at server startup
    { expiresIn: '24h' }      // Token valid for 24 hours
  );
};

/**
 * Helper to set the token inside an HttpOnly cookie
 * (same logic reused in register + login).
 */
const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    // httpOnly: true — cookie is NOT readable by JavaScript.
    // This is the primary XSS defense: even if an attacker injects a script,
    // they cannot steal the token via document.cookie or fetch().
    httpOnly: true,
    // secure: true in production — cookie is only sent over HTTPS connections.
    secure: process.env.NODE_ENV === 'production',
    // sameSite: prevents CSRF attacks by blocking cross-site cookie sending.
    // 'strict' in production, 'lax' in development (allows local testing).
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  });
};


module.exports = { createToken, setAuthCookie };