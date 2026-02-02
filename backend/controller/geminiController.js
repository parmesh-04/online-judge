const { analyzeCode } = require('../services/geminiService');
const Problem = require('../models/problem');

exports.analyzeSubmission = async (req, res) => {
  try {
    const { code, language, problemId } = req.body;

    console.log('Received request:', { code: code?.substring(0, 50) + '...', language, problemId });

    if (!code || !language || !problemId) {
      console.log('Missing fields:', { code: !!code, language: !!language, problemId: !!problemId });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get problem description for better analysis
    const problem = await Problem.findById(problemId);
    const problemDescription = problem ? problem.description : '';

    console.log('Problem found:', !!problem);

    // Analyze code with Gemini
    const analysis = await analyzeCode(code, language, problemDescription);

    console.log('Analysis completed:', { isCorrect: analysis.isCorrect });

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Code analysis error:', error.message);
    console.error('Full error:', error);
    
    // Return proper error response
    res.status(500).json({ 
      message: 'AI analysis service unavailable', 
      error: 'Unable to analyze code at the moment. Please try again later.'
    });
  }
};
