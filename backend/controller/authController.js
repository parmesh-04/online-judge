// backend/controller/authController.js
// Handles register, login, and logout.
// Auth uses JWT stored in an HttpOnly cookie to prevent XSS token theft.

const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { createToken, setAuthCookie } = require('../utils/jwt');
const { isStrongPassword, isValidEmail } = require('../utils/validation');

const register = async (req, res, next) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({ message: 'Firstname, lastname, email and password required' });
    }
    if (!String(firstname).trim() || !String(lastname).trim()) {
      return res.status(400).json({ message: 'Firstname and lastname required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'password must be 6+ chars with uppercase and number' });
    }
    if (await User.findOne({ email: email })) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email,
      password: hashedPassword,
      role: 'user',
    });

    const token = createToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({ message: 'Registered successfully', user: { id: newUser._id, email: newUser.email } });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'please enter complete details' });
    }

    const existingUser = await User.findOne({ email });

    // Use the same error message for both "not found" and "wrong password"
    // to prevent email enumeration
    if (!existingUser || !(await bcrypt.compare(password, existingUser.password))) {
      return res.status(401).json({ message: 'invalid credentials' });
    }

    const token = createToken(existingUser);
    setAuthCookie(res, token);

    return res.status(200).json({ message: 'logged in successfully', email: existingUser.email });
  } catch (error) {
    next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
};

module.exports = { register, login, logout };