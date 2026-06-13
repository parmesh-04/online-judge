// Purpose: Health check endpoint for Docker HEALTHCHECK and CI/CD pipeline.
// Returns server status, uptime, and MongoDB connection state.

const mongoose = require('mongoose');

exports.getHealth = (req, res) => {
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const mongoStatus = mongoStates[mongoose.connection.readyState] || 'unknown';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongoStatus,
  });
};
