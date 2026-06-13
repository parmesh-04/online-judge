// backend/middleware/auth.js
// JWT authentication middleware. Use as requireAuth() or requireAuth({ role: 'admin' }).

const jwt = require('jsonwebtoken');

const requireAuth = (options = {}) => {
  return (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (options.role === 'admin' && decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};

module.exports = { requireAuth };