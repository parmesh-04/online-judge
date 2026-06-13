// Purpose: Gemini AI controller — analyzes code submissions using Google Gemini API.
// This is the original analysis endpoint; new AI features are in aiController.js.

const { analyzeCode } = require('../services/geminiService');
const Problem = require('../models/problem');

exports.analyzeSubmission = async (req, res, next) => {
  try {
    const { code, language, problemId } = req.body;

    if (!code || !language || !problemId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get problem description for better analysis
    const problem = await Problem.findById(problemId);
    const problemDescription = problem ? problem.description : '';

    // Analyze code with Gemini
    const analysis = await analyzeCode(code, language, problemDescription);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    next(error);
  }
};
