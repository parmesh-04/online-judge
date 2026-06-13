// Purpose: Submission controller — records verdicts from the compiler service.
// When the compiler finishes judging, it POSTs the verdict here.

const Submission = require('../models/submission');
const User = require('../models/user');

exports.reportVerdict = async (req, res, next) => {
  try {
    const { problemId, verdict, code, language } = req.body;

    if (!problemId || !verdict || !code || !language) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const submission = await Submission.create({
      userId: req.user.id,
      problemId,
      verdict,
      code,
      language,
    });

    if (String(verdict).toLowerCase().includes('accepted')) {
      // Add problemId directly to user's solvedProblems
      await User.updateOne(
        { _id: req.user.id },
        { $addToSet: { solvedProblems: problemId } }
      );
    }

    return res.status(201).json({ message: 'Verdict saved', submissionId: submission._id });
  } catch (error) {
    next(error);
  }
};