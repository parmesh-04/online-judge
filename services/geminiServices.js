const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analyzeCode = async (code, language, problemDescription = '') => {
  try {
    console.log('Gemini API Key exists:', !!process.env.GEMINI_API_KEY);
    console.log('Code length:', code.length);
    console.log('Language:', language);
    
    // Try the latest model that should work with fresh API keys
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    console.log('Using model: gemini-1.5-flash');
    
    const prompt = `
    Analyze this code submission for correctness and quality.

    Language: ${language}
    Problem: ${problemDescription}

    Code:
    ${code}

    Return JSON:
    {
      "isCorrect": true/false,
      "feedback": "Detailed feedback about the code",
      "hints": ["Hint 1", "Hint 2"]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini response length:', text.length);
    console.log('Gemini response preview:', text.substring(0, 100));
    
    // Try to parse JSON, if fails return text-based analysis
    try {
      const parsed = JSON.parse(text);
      return {
        isCorrect: parsed.isCorrect,
        feedback: parsed.feedback,
        hints: parsed.hints || []
      };
    } catch (e) {
      console.log('JSON parse failed, using text analysis');
      // Simple text-based analysis
      const isCorrect = text.toLowerCase().includes('correct') || 
                       text.toLowerCase().includes('well done') ||
                       text.toLowerCase().includes('good') ||
                       !text.toLowerCase().includes('error') &&
                       !text.toLowerCase().includes('wrong') &&
                       !text.toLowerCase().includes('incorrect');
      
      return {
        isCorrect,
        feedback: text,
        hints: ['Consider edge cases', 'Review your logic', 'Check for input handling']
      };
    }
    
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw error;
  }
};

module.exports = { analyzeCode };
