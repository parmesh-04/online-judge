// ═══════════════════════════════════════════════════════════════════════
// backend/models/user.js — User schema and model
// ═══════════════════════════════════════════════════════════════════════
//
// Defines the User document structure in MongoDB.
// Passwords are hashed in the controller (authController.js) before saving,
// not in a pre-save hook, to keep the model layer simple and predictable.
//
// Indexes:
//   { email: 1 }           → unique lookup during login (email is the username)
//   { solvedProblems: 1 }  → efficient leaderboard queries that sort by solve count
// ═══════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  // ── User's first name (displayed on profile and leaderboard) ──
  firstname: {
    type: String,
    required: true,
    trim: true,  // removes leading/trailing whitespace
  },

  // ── User's last name ──
  lastname: {
    type: String,
    required: true,
    trim: true,
  },

  // ── Email — acts as the unique username for login ──
  // lowercase: true ensures "User@Gmail.com" and "user@gmail.com" are the same
  // unique: true creates a unique index automatically (may cause duplicate index warning)
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  // ── Password — always stored as a bcrypt hash, NEVER plaintext ──
  // Hashing is done in authController.js using bcrypt.hash(password, 10)
  // The "10" is the salt rounds (2^10 = 1024 iterations).
  // Higher rounds = more secure but slower. 10 is the industry standard
  // balancing security (~100ms to hash) vs. performance.
  password: {
    type: String,
    required: true,
  },

  // ── Role — either 'user' or 'admin' ──
  // admin: can create/delete problems
  // user: can solve problems and view leaderboard
  // Default is 'user' — admin must be set manually or via seed script
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },

  // ── Solved problems — array of ObjectId references to Problem documents ──
  // This is updated when a user's submission gets "Accepted" verdict.
  // Used by the leaderboard to rank users by number of problems solved.
  // Array (not Set) because Mongoose doesn't support Set types natively.
  solvedProblems: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    default: [],
  },

}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

// ── Indexes ──
// { email: 1 }: Speeds up User.findOne({ email }) during login.
//   This duplicates the unique index, but is explicit for clarity.
userSchema.index({ email: 1 });

// { solvedProblems: 1 }: Speeds up leaderboard queries that
//   sort or filter by number of solved problems.
userSchema.index({ solvedProblems: 1 });

module.exports = mongoose.model('User', userSchema);