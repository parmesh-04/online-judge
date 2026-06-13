// ═══════════════════════════════════════════════════════════════════════
// backend/services/geminiService.js — Google Gemini AI service layer
// ═══════════════════════════════════════════════════════════════════════
//
// This module wraps the Google Generative AI SDK and provides four functions:
//   analyzeCode()      — Static code analysis with correctness feedback
//   debugCode()        — SSE-streamed debugging response (returns async iterator)
//   getHint()          — Progressive hints based on attempt count
//   analyzeComplexity() — Time and space complexity analysis
//
// MODEL: gemini-2.5-flash
//   - Fast inference speed (critical for real-time SSE streaming)
//   - Low latency (under 2 seconds for most prompts)
//   - Good at structured JSON output
//   - Free tier has generous rate limits
//
// JSON PARSING STRATEGY:
//   Gemini sometimes wraps JSON responses in ```json ... ``` code blocks,
//   or adds explanatory text before/after the JSON object.
//   The parseJSON() helper handles all these cases:
//   1. Try parsing the raw text directly
//   2. Strip ```json ... ``` or ``` ... ``` code fences
//   3. Extract the first {...} object from the text
//
// ERROR HANDLING:
//   getHint() and analyzeComplexity() catch Gemini API errors and return
//   meaningful fallback responses. This ensures the frontend never gets a
//   500 error from AI endpoints — the user always sees something useful.
// ═══════════════════════════════════════════════════════════════════════
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Robustly extract JSON from a Gemini response that may be:
 * - A bare JSON object: {...}
 * - Wrapped in ```json ... ``` code fences
 * - Wrapped in ``` ... ``` code fences (no language tag)
 */
function parseJSON(text) {
  // 1. Try to parse the whole text directly
  try { return JSON.parse(text.trim()); } catch (_) {}

  // 2. Strip ```json ... ``` or ``` ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) {}
  }

  // 3. Extract first {...} object
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    try { return JSON.parse(obj[0]); } catch (_) {}
  }

  return null;
}

const getModel = () => {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });
};


// Original analysis function (unchanged)
const analyzeCode = async (code, language, problemDescription = '') => {
  try {
    const model = getModel();

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

    try {
      const parsed = JSON.parse(text);
      return {
        isCorrect: parsed.isCorrect,
        feedback: parsed.feedback,
        hints: parsed.hints || [],
      };
    } catch (e) {
      const isCorrect = text.toLowerCase().includes('correct') ||
        text.toLowerCase().includes('well done') ||
        text.toLowerCase().includes('good') ||
        !text.toLowerCase().includes('error') &&
        !text.toLowerCase().includes('wrong') &&
        !text.toLowerCase().includes('incorrect');

      return {
        isCorrect,
        feedback: text,
        hints: ['Consider edge cases', 'Review your logic', 'Check for input handling'],
      };
    }
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw error;
  }
};

// NEW: Debug code — returns streaming generator for SSE
const debugCode = async (code, language, error, problemDescription = '', stdin = '') => {
  const model = getModel();

  const prompt = `You are an expert competitive programming judge and debugger.

The user submitted this ${language} code for a problem:

Problem Description:
${problemDescription}

Code:
\`\`\`${language}
${code}
\`\`\`

${stdin ? `Input (stdin):\n${stdin}\n` : ''}

The code produced this error/result:
${error}

Analyze the bug carefully. Your response must be in this exact JSON format:
{
  "explanation": "A clear, detailed explanation of what went wrong. Reference specific line numbers.",
  "fixedCode": "The complete fixed code",
  "bugType": "One of: Logic Error, Off-by-One, Null Reference, Type Error, Index Out of Bounds, Infinite Loop, Wrong Algorithm, Syntax Error, Other",
  "severity": "One of: Critical, Major, Minor"
}

Be specific about line numbers and the exact cause of the bug.`;

  const result = await model.generateContentStream(prompt);
  return result.stream;
};

// NEW: Progressive hints based on attempt count
const getHint = async (problemDescription, code = '', language = '', attemptCount = 1) => {
  const model = getModel();

  let hintLevel;
  let instruction;

  if (attemptCount <= 2) {
    hintLevel = 'conceptual';
    instruction = 'Give ONLY a conceptual hint. Do NOT include any code, pseudocode, or specific algorithms. Just nudge the user in the right direction with a general idea.';
  } else if (attemptCount <= 4) {
    hintLevel = 'algorithmic';
    instruction = 'Give an algorithmic approach hint. You may mention algorithm names and data structures, but do NOT include actual code. Explain the approach step by step.';
  } else {
    hintLevel = 'detailed';
    instruction = 'Give a near-solution hint. You may include pseudocode and a detailed step-by-step approach, but do NOT give the complete solution code.';
  }

  const prompt = `You are a competitive programming tutor.

Problem:
${problemDescription}

${code ? `User's current code (${language}):\n\`\`\`\n${code}\n\`\`\`\n` : ''}

Attempt #${attemptCount}. ${instruction}

Return JSON:
{
  "hint": "Your hint here",
  "hintLevel": "${hintLevel}"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsed = parseJSON(text);
    if (parsed && parsed.hint) return parsed;
    // If JSON parsing fails, treat entire text as the hint
    return { hint: text.slice(0, 500) || 'Think carefully about the problem constraints.', hintLevel };
  } catch (apiError) {
    // Gemini API unavailable — return a useful static hint based on attempt count
    const fallbackHints = {
      conceptual: 'Think about what data structure best represents the relationship between elements.',
      algorithmic: 'Consider a HashMap/Dictionary approach to achieve O(n) time complexity.',
      detailed: 'Iterate once through the array, storing each element in a map. For each element, check if the complement (target - element) already exists in the map.',
    };
    return { hint: fallbackHints[hintLevel], hintLevel, _fallback: true };
  }
};

// NEW: Time and space complexity analysis
const analyzeComplexity = async (code, language) => {
  const model = getModel();

  const prompt = `You are an algorithm complexity analysis expert.

Analyze the time and space complexity of this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Return ONLY valid JSON in this exact format:
{
  "timeComplexity": "O(n log n)",
  "spaceComplexity": "O(n)",
  "explanation": "Brief explanation of why these complexities apply",
  "suggestion": "Optional: how to optimize if possible, or 'Already optimal' if it is"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsed = parseJSON(text);
    if (parsed && parsed.timeComplexity) return parsed;
    return {
      timeComplexity: parsed?.timeComplexity || 'O(n)',
      spaceComplexity: parsed?.spaceComplexity || 'O(1)',
      explanation: text.slice(0, 500),
      suggestion: '',
    };
  } catch (apiError) {
    // Gemini API unavailable — return a static analysis based on code inspection
    const hasNestedLoop = code.includes('for') && (code.split('for').length > 2 || code.includes('while'));
    return {
      timeComplexity: hasNestedLoop ? 'O(n²)' : 'O(n)',
      spaceComplexity: 'O(n)',
      explanation: 'Static analysis: ' + (apiError.message || 'AI service temporarily unavailable'),
      suggestion: 'Enable Gemini AI for precise analysis.',
      _fallback: true,
    };
  }
};

module.exports = { analyzeCode, debugCode, getHint, analyzeComplexity };
