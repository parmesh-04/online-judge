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
exports.getAllProblems = async (req, res) => {
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

    console.log(`Pagination: page=${page}, limit=${limit}, skip=${skip}`);

    // Use aggregation pipeline with pagination
    const problems = await Problem.aggregate([
      // Stage 1: Filter problems based on query parameters
      { $match: filter },
      
      // Stage 2: Include only needed fields (inclusion-only projection)
      { $project: { 
        title: 1,
        description: 1,
        difficulty: 1,
        tags: 1,
        createdAt: 1
      }},
      
      // Stage 3: Sort by creation time
      { $sort: { createdAt: 1 } },
      
      // Stage 4: Pagination - skip and limit
      { $skip: skip },
      { $limit: limit }
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
      pageSize: limit
    };

    res.json({
      problems,
      pagination
    });
  } catch (error) {
    console.error('getAllProblems error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Fetch a single problem by its MongoDB _id
exports.getProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new problem
exports.createProblem = async (req, res) => {
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
      hiddenTestCases: hiddenTestCases || []
    });

    res.status(201).json(problem);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a problem and remove references from users
exports.deleteProblem = async (req, res) => {
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
    res.status(500).json({ message: 'Server error' });
  }
};
