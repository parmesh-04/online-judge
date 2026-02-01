const jwt = require('jsonwebtoken')

const requireAuth = (options = {}) => {
  // This function RETURNS another function (middleware factory)
  // options can include things like: { role: 'admin' }
  return (req, res, next) => {
    // 1️⃣ Read token from cookies (set at login)
    const token = req.cookies.token;

    // If no token → user is not logged in
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // 2️⃣ Verify the token using our SECRET_KEY
      // If token is tampered or expired → this will throw an error
      const decoded = jwt.verify(token, process.env.SECRET_KEY);

      // 3️⃣ Optional role-based authorization
      // If route requires admin but user is not admin → block
      if (options.role === 'admin' && decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // 4️⃣ Attach user info to req so routes can access it (req.user.id, req.user.role, etc.)
      req.user = decoded;

      // 5️⃣ Allow request to continue to the route handler
      next();
    } catch (err) {
      // Token invalid / expired
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};

module.exports = { requireAuth };