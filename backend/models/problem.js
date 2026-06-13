// ═══════════════════════════════════════════════════════════════════════
// backend/models/problem.js — Problem schema and model
// ═══════════════════════════════════════════════════════════════════════
//
// Represents a competitive programming problem in the database.
// Each problem has visible sample I/O (shown to users) and hidden test cases
// (used by the compiler service for judging — NEVER sent to the client).
//
// Difficulty levels:
//   1 = Easy   (e.g., Two Sum, Binary Search)
//   2 = Medium (e.g., Maximum Subarray, Merge Intervals)
//   3 = Hard   (e.g., LRU Cache, Word Search)
//
// Indexes:
//   { difficulty: 1, tags: 1 }              → filter by difficulty + tags
//   { title: 'text', description: 'text' }  → full-text search across problems
// ═══════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    // ── Problem title — displayed in the problem list ──
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ── Full problem description with examples and constraints ──
    // Supports Markdown formatting for rendering in the frontend
    description: {
      type: String,
      required: true,
    },

    // ── Sample input — visible to users as an example ──
    input: {
      type: String,
      default: '',
    },

    // ── Expected sample output — visible to users ──
    output: {
      type: String,
      default: '',
    },

    // ── Hidden test cases — NEVER sent to the client ──
    // These are the actual test cases used by the compiler service to judge
    // submissions. They are stripped from API responses via .select('-hiddenTestCases')
    // in problemController.js. Only the compiler service can access them by
    // sending the X-Judge-Service-Key header (see JUDGE_SERVICE_KEY in .env).
    hiddenTestCases: {
      type: [
        {
          input: { type: String, required: true },
          output: { type: String, default: '' },
        },
      ],
      default: [],
    },

    // ── Difficulty level ──
    // 1 = Easy, 2 = Medium, 3 = Hard
    // Stored as a number for efficient sorting and filtering.
    // The frontend maps these to color-coded labels.
    difficulty: {
      type: Number,
      required: true,
    },

    // ── Tags — topic categories for filtering ──
    // Examples: "Array", "Dynamic Programming", "DFS", "Hash Map"
    // Used for the tag filter on the problems page.
    tags: {
      type: [String],
      default: [],
    },
  },
);

// ── Indexes for efficient queries ──

// Compound index: enables fast queries like "show all Medium DFS problems"
// db.problems.find({ difficulty: 2, tags: "DFS" })
problemSchema.index({ difficulty: 1, tags: 1 });

// Text index: enables full-text search across problem titles and descriptions
// db.problems.find({ $text: { $search: "binary search" } })
problemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model("Problem", problemSchema);