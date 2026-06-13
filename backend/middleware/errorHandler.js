// Purpose: Global Express error handler middleware.
// Catches all errors passed via next(err) and returns appropriate responses.
// Must be mounted LAST in the middleware chain.

const errorHandler = (err, req, res, next) => {
  // Log the full error with timestamp (always, regardless of environment)
  console.error(`[${new Date().toISOString()}] Error:`, err);

  // Default status and message
  let statusCode = err.statusCode || 500;
  let message = 'Internal server error';
  let details = undefined;

  // --- Handle specific error types ---

  // MongoDB duplicate key error (e.g., unique email)
  if (err.code === 11000 || err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `Duplicate value for '${field}'. This ${field} already exists.`;
  }

  // Mongoose validation error (e.g., required field missing)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // JWT authentication errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Mongoose CastError (invalid ObjectId format)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Build response
  const response = {
    error: message,
    code: statusCode,
  };

  if (details) {
    response.details = details;
  }

  // In development, include the full error stack for debugging
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
    response.originalError = err.message;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
