// backend/models/user.js
// User schema — passwords are hashed before saving in authController, not here.

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  firstname: {
    type: String,
    required: true,
    trim: true,
  },

  lastname: {
    type: String,
    required: true,
    trim: true,
  },

  // Email is used as the unique login identifier
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  // Always stored as a bcrypt hash, never plaintext
  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },

  // Updated when a submission gets Accepted verdict, used by the leaderboard
  solvedProblems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    default: [],
  },

}, { timestamps: true });

// Index for leaderboard queries — email index is created automatically by unique:true
userSchema.index({ solvedProblems: 1 });

module.exports = mongoose.model('User', userSchema);