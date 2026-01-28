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
      email: user.email, //this is the payload i want it to store
      role: user.role
    },
    process.env.SECRET_KEY,           // secret used to sign the token
    { expiresIn: '24h' }              // token validity period
  );
};
// we sign the jwt token using payload , secret key that is only stored in the server  
/**
 * Helper to set the token inside an HttpOnly cookie
 * (same logic reused in register + login).
 */
const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true, 
    // not readable by JS so we dont get XSS attack 
    // Cookies with httpOnly flag protect against XSS because JavaScript 
    // cannot access them. LocalStorage is readable from any script running on the page.
    secure: process.env.NODE_ENV === 'production',//tells if https connection is used or not
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',//tells if the cookie can be sent to cross-site or not
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
};

module.exports = { createToken, setAuthCookie };