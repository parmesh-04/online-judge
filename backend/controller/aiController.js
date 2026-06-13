// ═══════════════════════════════════════════════════════════════════════
// backend/controller/aiController.js — AI-powered code analysis endpoints
// ═══════════════════════════════════════════════════════════════════════
//
// Provides three AI endpoints powered by Google Gemini:
//   POST /api/ai/debug      — Debug code with SSE streaming response
//   POST /api/ai/hint       — Progressive hints based on attempt count
//   POST /api/ai/complexity — Time/space complexity analysis
//
// All endpoints are rate-limited (20 req/15min per IP) via aiLimiter in server.js.
// Each endpoint also requires authentication (authMiddleware in routes).
//
// Why SSE streaming for debug?
//   - The AI response can take 3-10 seconds to generate fully
//   - SSE lets the user see partial text as it's being generated
//   - Much better UX than staring at a loading spinner for 10 seconds
//   - Uses text/event-stream Content-Type with chunked transfer encoding
// ═══════════════════════════════════════════════════════════════════════

const { debugCode, getHint, analyzeComplexity } = require('../services/geminiService');

/**
 * POST /api/ai/debug — Streaming SSE debug response
 *
 * Accepts the user's code, language, error output, and problem description.
 * Streams the AI's analysis back in real-time using Server-Sent Events (SSE).
 *
 * SSE Protocol:
 *   Each chunk is: "data: {JSON}\n\n"
 *   During streaming: { text: "partial text", done: false }
 *   Final chunk:      { done: true, parsed: { ... } }
 *
 * The parsed field in the final chunk contains the complete JSON response
 * (explanation, fixedCode, bugType, severity) if the AI returned valid JSON.
 */
exports.debug = async (req, res, next) => {
  try {
    const { code, language, error, problemDescription, stdin } = req.body;

    // Validate required fields
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    // ── Set up SSE headers ──
    // Content-Type: text/event-stream — tells the browser this is an SSE stream
    // Cache-Control: no-cache — prevents caching of streaming responses
    // Connection: keep-alive — keeps the connection open for streaming
    // X-Accel-Buffering: no — tells nginx to NOT buffer the response
    //   (without this, nginx batches all chunks and sends them at once, breaking SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();  // Send headers immediately

    // ── Stream AI response ──
    const stream = await debugCode(code, language, error || '', problemDescription || '', stdin || '');

    let fullText = '';

    // Iterate over the AI's streaming response — each chunk is a partial text
    for await (const chunk of stream) {
      const text = chunk.text();
      fullText += text;
      // Send each chunk as an SSE event
      res.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
    }

    // ── Parse the complete response ──
    // Try to extract structured JSON from the full response text.
    // The AI is prompted to return { explanation, fixedCode, bugType, severity }
    // but sometimes wraps it in markdown code blocks or adds extra text.
    let parsed = null;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // If parsing fails, the raw text was already streamed — that's fine
    }

    // Send the final "done" event with the parsed JSON
    res.write(`data: ${JSON.stringify({ done: true, parsed })}\n\n`);
    res.end();
  } catch (error) {
    // If headers are already sent (streaming started), we can't change status code.
    // Instead, send the error as an SSE event so the frontend can handle it.
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
      res.end();
    } else {
      next(error);  // Headers not sent yet — use normal error handling
    }
  }
};

/**
 * POST /api/ai/hint — Progressive hints based on attempt count
 *
 * Hint levels (controlled by attemptCount):
 *   Attempts 1-2: "conceptual" — vague directional hint, no code
 *   Attempts 3-4: "algorithmic" — mention algorithm names and data structures
 *   Attempts 5+:  "detailed" — near-solution with pseudocode
 *
 * This progressive approach encourages learning:
 *   - Early attempts: user should think independently
 *   - Later attempts: more help is provided as frustration increases
 *   - Never gives the complete solution code
 */
exports.hint = async (req, res, next) => {
  try {
    const { problemDescription, code, language, attemptCount } = req.body;

    if (!problemDescription) {
      return res.status(400).json({ error: 'Problem description is required' });
    }

    const count = parseInt(attemptCount) || 1;
    const result = await getHint(problemDescription, code || '', language || '', count);

    res.json({
      hint: result.hint,
      hintLevel: result.hintLevel,
      remainingFreeHints: Math.max(0, 10 - count),  // Show remaining hints to user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/complexity — Analyze time and space complexity
 *
 * Returns: { timeComplexity, spaceComplexity, explanation, suggestion }
 *
 * If the Gemini API is unavailable, falls back to a static analysis
 * that inspects the code for nested loops (see geminiService.js).
 */
exports.complexity = async (req, res, next) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const result = await analyzeComplexity(code, language);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
