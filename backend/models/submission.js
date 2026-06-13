// ═══════════════════════════════════════════════════════════════════════
// backend/models/submission.js — Submission schema and model
// ═══════════════════════════════════════════════════════════════════════
//
// Represents a single code submission by a user for a problem.
// Every submission — accepted, wrong answer, compile error, etc. — is stored
// permanently. This provides a full audit trail and enables:
//   - Submission history per user per problem
//   - Leaderboard calculations (count of accepted submissions)
//   - Analytics (most common errors, popular languages, etc.)
//
// Verdict values (stored as strings):
//   "✅ Accepted"           — correct output on all hidden test cases
//   "❌ Wrong Answer"       — output doesn't match expected on at least one test
//   "❌ Compile Error:..."  — code failed to compile (C++/Java)
//   "❌ Runtime Error:..."  — code crashed during execution
//   "❌ Time Limit Exceeded" — execution exceeded the 10s timeout
//
// Indexes:
//   { userId: 1, problemId: 1, createdAt: -1 }
//     → "Show me all submissions by user X for problem Y, newest first"
//     → Used on the submission history page
//
//   { verdict: 1, createdAt: -1 }
//     → "Show me all accepted submissions, newest first"
//     → Used for leaderboard and analytics
// ═══════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({

  // ── User who submitted — reference to User document ──
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,  // Single-field index for quick lookup by user
  },

  // ── Problem being solved — reference to Problem document ──
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true,
    index: true,  // Single-field index for quick lookup by problem
  },

  // ── Programming language used (cpp, python, javascript, java) ──
  language: {
    type: String,
    required: true,
  },

  // ── Full source code submitted ──
  // We store the complete code (not just a reference or hash) because:
  // 1. Audit trail — know exactly what the user submitted
  // 2. Plagiarism detection (future feature)
  // 3. Users can review their past submissions
  // 4. No external storage dependency (S3, etc.)
  code: {
    type: String,
    required: true,
  },

  // ── Verdict string — result of judging ──
  // See header comment for all possible values.
  verdict: {
    type: String,
    required: true,
  },

}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// ── Compound indexes for efficient queries ──

// Index 1: User's submissions for a specific problem, sorted by newest first.
// Covers the query pattern: Submission.find({ userId, problemId }).sort({ createdAt: -1 })
submissionSchema.index({ userId: 1, problemId: 1, createdAt: -1 });

// Index 2: Filter by verdict, sorted by newest first.
// Covers: Submission.find({ verdict: /Accepted/ }).sort({ createdAt: -1 })
submissionSchema.index({ verdict: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);