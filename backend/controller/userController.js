
const User = require('../models/user');
const Problem = require('../models/problem');
const Submission = require('../models/submission');
const { ObjectId } = require('mongoose').Types;

// -------------------------------------------------------
// GET USER STATS (simple version — no heavy aggregations)
// -------------------------------------------------------
exports.getUserStats = async (req, res) => {
  try {
    // 1) Get user basic info
    const user = await User.findById(req.user.id)
      .select('firstname lastname email solvedProblems');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2) Get solved problem details with projection (optimized)
    let solvedProblemsDetails = [];
    if (user.solvedProblems && user.solvedProblems.length > 0) {
      solvedProblemsDetails = await Problem.find({ 
        _id: { $in: user.solvedProblems } 
      })
      .select('title difficulty')  // Only needed fields
      .sort({ title: 1 });        // Sort by title
    }

    // 3) Compute simple stats
    const totalSolved = user.solvedProblems ? user.solvedProblems.length : 0;

    res.json({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      totalSolved,
      solvedProblems: solvedProblemsDetails  // Frontend can show green tick + title
    });
  } catch (err) {
    console.error('getUserStats error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// -------------------------------------------------------
// PUBLIC PROFILE (same logic, but hides sensitive fields)
// -------------------------------------------------------
exports.getPublicProfile = async (req, res) => {
  try {
    // 1) Get user basic info
    const user = await User.findById(req.params.userId)
      .select('firstname lastname solvedProblems');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2) Compute simple stats
    const solvedCount = user.solvedProblems.length;

    res.json({
      firstname: user.firstname,
      lastname: user.lastname,
      solvedCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------------------------------------------
// LEADERBOARD (simple sorting by solved count)
// -------------------------------------------------------
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.aggregate([
      {
        $project: {
          _id: 0,
          username: { $concat: ['$firstname', ' ', '$lastname'] },
          problemsSolved: { $size: { $ifNull: ['$solvedProblems', []] } },
        },
      },
      { $sort: { problemsSolved: -1 } },
    ]);

    return res.json(leaderboard);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};