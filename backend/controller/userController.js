// Purpose: User controller — stats, public profile, and leaderboard.
// Provides endpoints for user statistics and global rankings.

const User = require('../models/user');
const Problem = require('../models/problem');
const Submission = require('../models/submission');

// -------------------------------------------------------
// GET USER STATS (simple version — no heavy aggregations)
// -------------------------------------------------------
exports.getUserStats = async (req, res, next) => {
  try {
    // 1) Get user basic info
    const user = await User.findById(req.user.id)
      .select('firstname lastname email solvedProblems role createdAt');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // 2) Get solved problem details with projection (optimized)
    let solvedProblemsDetails = [];
    if (user.solvedProblems && user.solvedProblems.length > 0) {
      solvedProblemsDetails = await Problem.find({
        _id: { $in: user.solvedProblems },
      })
        .select('title difficulty')
        .sort({ title: 1 });
    }

    // 3) Get total submissions count
    const totalSubmissions = await Submission.countDocuments({ userId: req.user.id });

    // 4) Get recent submissions
    const recentSubmissions = await Submission.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('problemId', 'title')
      .select('problemId verdict language createdAt');

    // 5) Get submission dates for heatmap (last 84 days)
    const heatmapStart = new Date();
    heatmapStart.setDate(heatmapStart.getDate() - 84);
    const submissionDates = await Submission.aggregate([
      { $match: { userId: user._id, createdAt: { $gte: heatmapStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]);

    // 6) Compute simple stats
    const totalSolved = user.solvedProblems ? user.solvedProblems.length : 0;
    const successRate = totalSubmissions > 0
      ? Math.round((totalSolved / totalSubmissions) * 100)
      : 0;

    res.json({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      totalSolved,
      totalSubmissions,
      successRate,
      solvedProblems: solvedProblemsDetails,
      recentSubmissions,
      submissionHeatmap: submissionDates,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------
// PUBLIC PROFILE (same logic, but hides sensitive fields)
// -------------------------------------------------------
exports.getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('firstname lastname solvedProblems');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const solvedCount = user.solvedProblems.length;

    res.json({
      firstname: user.firstname,
      lastname: user.lastname,
      solvedCount,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------
// LEADERBOARD (simple sorting by solved count)
// -------------------------------------------------------
exports.getLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await User.aggregate([
      {
        $project: {
          _id: 1,
          username: { $concat: ['$firstname', ' ', '$lastname'] },
          firstname: 1,
          problemsSolved: { $size: { $ifNull: ['$solvedProblems', []] } },
        },
      },
      { $sort: { problemsSolved: -1 } },
    ]);

    return res.json(leaderboard);
  } catch (err) {
    next(err);
  }
};