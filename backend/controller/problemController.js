// ═══════════════════════════════════════════════════════════════════════
// backend/controller/problemController.js — Problem CRUD controller
// ═══════════════════════════════════════════════════════════════════════
//
// Handles listing, fetching, creating, and deleting problems.
// Uses MongoDB aggregation for efficient pagination.
//
// SECURITY MODEL FOR HIDDEN TEST CASES:
//   Problems have a `hiddenTestCases` array that contains the actual test
//   cases used for judging. These must NEVER be exposed to end users.
//
//   - getAllProblems(): Uses $project aggregation to exclude hiddenTestCases
//   - getProblem(): Uses .select('-hiddenTestCases') for public requests
//   - getProblem() + X-Judge-Service-Key: Returns full doc for the compiler
//
//   The compiler service authenticates via the JUDGE_SERVICE_KEY env var,
//   sent as the X-Judge-Service-Key header. This is checked against the
//   backend's JUDGE_SERVICE_KEY. If they match, the full problem is returned.
// ═══════════════════════════════════════════════════════════════════════
const Problem = require('../models/problem');
const User = require('../models/user');

// Normalizes the "tags" input into a clean array.
// Accepts: undefined, string ("a,b,c"), or array, and always returns an array.
const normalizeTags = (tags) => {
  // No tags provided
  if (!tags) return [];
  // Already an array: trim values and remove empties
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  // Comma‑separated string: split into array
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
};

// Fetch all problems with pagination (hidden testcases excluded)
exports.getAllProblems = async (req, res, next) => {
  try {
    // Build optional filter
    const filter = {};

    // Filter by tag if provided: /api/problems?tag=dp
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }

    // Filter by difficulty if provided: /api/problems?difficulty=Easy
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Use aggregation pipeline with pagination
    const problems = await Problem.aggregate([
      { $match: filter },
      { $project: {
        title: 1,
        description: 1,
        difficulty: 1,
        tags: 1,
        createdAt: 1,
      }},
      { $sort: { createdAt: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Get total count for pagination metadata
    const totalCount = await Problem.countDocuments(filter);

    // Pagination metadata
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalProblems: totalCount,
      hasNext: page * limit < totalCount,
      hasPrev: page > 1,
      pageSize: limit,
    };

    res.json({
      problems,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch a single problem by its MongoDB _id
// - Public requests: hiddenTestCases stripped (security)
// - Internal compiler requests with X-Judge-Service-Key: full problem returned
exports.getProblem = async (req, res, next) => {
  try {
    const serviceKey = req.headers['x-judge-service-key'];
    const isInternalService = serviceKey && serviceKey === process.env.JUDGE_SERVICE_KEY;

    const query = isInternalService
      ? Problem.findById(req.params.id)                         // full doc for judging
      : Problem.findById(req.params.id).select('-hiddenTestCases'); // stripped for public

    const problem = await query;
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    res.json(problem);
  } catch (error) {
    next(error);
  }
};


// Create a new problem
exports.createProblem = async (req, res, next) => {
  try {
    const { title, description, difficulty, tags, hiddenTestCases } = req.body;

    // Required fields validation
    if (!title || !description || !difficulty) {
      return res.status(400).json({ message: 'Title, description, and difficulty required' });
    }

    // Insert problem document
    const problem = await Problem.create({
      title,
      description,
      difficulty,
      tags: normalizeTags(tags),
      hiddenTestCases: hiddenTestCases || [],
    });

    res.status(201).json(problem);
  } catch (error) {
    next(error);
  }
};

// Delete a problem and remove references from users
exports.deleteProblem = async (req, res, next) => {
  try {
    const deleted = await Problem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Problem not found' });

    // Remove deleted problem from all users' solved lists
    await User.updateMany(
      { solvedProblems: deleted._id },
      { $pull: { solvedProblems: deleted._id } }
    );

    res.json({ message: 'Problem deleted' });
  } catch (error) {
    next(error);
  }
};
