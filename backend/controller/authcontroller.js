// ═══════════════════════════════════════════════════════════════════════
// backend/controller/authController.js — Authentication controller
// ═══════════════════════════════════════════════════════════════════════
//
// Handles the full authentication lifecycle:
//   register → login → logout
//
// Auth strategy: JWT stored in an HttpOnly cookie.
// Why HttpOnly cookie instead of localStorage?
//   - HttpOnly cookies are NOT accessible via JavaScript (document.cookie)
//   - This prevents XSS attacks from stealing the token
//   - The browser automatically sends the cookie with every request
//   - No need for the frontend to manage tokens manually
//
// JWT expiry: 7 days (configured in utils/jwt.js)
//   - Long enough for a good UX (users don't re-login constantly)
//   - Short enough that stolen tokens expire relatively quickly
//   - For higher security, reduce to 1 hour + add refresh tokens
// ═══════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { createToken, setAuthCookie } = require('../utils/jwt');
const { isStrongPassword, isValidEmail } = require('../utils/validation');

/**
 * POST /api/auth/register — Create a new user account
 *
 * Registration flow:
 * 1. Validate all input fields (firstname, lastname, email, password)
 * 2. Verify email format and password strength
 * 3. Check for duplicate email (unique constraint)
 * 4. Hash password with bcrypt (NEVER store plaintext)
 * 5. Create user document in MongoDB
 * 6. Generate JWT token
 * 7. Set HttpOnly cookie with the token
 * 8. Return minimal safe user data (id + email, NOT password)
 */
const register = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    // ── Step 1: Validate required fields ──
    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({ message: 'Firstname, lastname, email and password required' });
    }
    if (!String(firstname).trim() || !String(lastname).trim()) {
      return res.status(400).json({ message: 'Firstname and lastname required' });
    }

    // ── Step 2: Validate email format ──
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // ── Step 3: Validate password strength ──
    // Requires: 6+ chars, at least one uppercase letter, at least one number
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'password must be 6+ chars with uppercase and number' });
    }

    // ── Step 4: Check for duplicate email ──
    if (await User.findOne({ email: email })) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // ── Step 5: Hash the password before saving ──
    // bcrypt.hash(password, 10):
    //   - "10" = salt rounds (2^10 = 1024 iterations of the key derivation)
    //   - Higher rounds = more secure but slower
    //   - 10 takes ~100ms — good balance of security vs performance
    //   - The salt is embedded in the hash output (no separate salt storage needed)
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Step 6: Create the user document in MongoDB ──
    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email,
      password: hashedPassword,
      role: 'user',  // Default role — admin must be set manually or via seed
    });

    // ── Step 7: Create JWT and set as HttpOnly cookie ──
    const token = createToken(newUser);
    setAuthCookie(res, token);

    // ── Step 8: Send minimal safe user data (never include password) ──
    res.status(201).json({ message: 'Registered successfully', user: { id: newUser._id, email: newUser.email } });
  } catch (error) {
    next(error);  // Forward to global error handler
  }
};

/**
 * POST /api/auth/login — Authenticate an existing user
 *
 * Login flow:
 * 1. Validate input (email + password required)
 * 2. Look up user by email
 * 3. Compare provided password against stored bcrypt hash
 * 4. If match: generate JWT → set cookie → return success
 * 5. If no match: return generic "invalid credentials" (don't reveal which field was wrong)
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── Step 1: Validate input ──
    if (!email || !password) {
      return res.status(400).json({ message: 'please enter complete details' });
    }

    // ── Step 2: Look up user by email ──
    const existingUser = await User.findOne({ email });

    // ── Step 3-4: Verify password ──
    // SECURITY: We use a single generic error message for BOTH "user not found"
    // and "wrong password" to prevent email enumeration attacks.
    if (!existingUser || !(await bcrypt.compare(password, existingUser.password))) {
      return res.status(401).json({ message: 'invalid credentials' });
    }

    // ── Step 5: Generate JWT for authenticated user ──
    const token = createToken(existingUser);
    setAuthCookie(res, token);

    // ── Successful login — return email for frontend state ──
    return res.status(200).json({ message: 'logged in successfully', email: existingUser.email });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout — End the user's session
 *
 * Since we use JWT in HttpOnly cookies (not server-side sessions),
 * "logging out" simply means clearing the cookie from the browser.
 * The JWT itself is stateless and can't be truly "invalidated" without
 * a token blacklist (not implemented here for simplicity).
 *
 * NOTE: This route is NOT rate-limited (unlike login/register).
 * Rate-limiting logout would be a UX bug — users should always be able to log out.
 */
const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
};

module.exports = { register, login, logout };