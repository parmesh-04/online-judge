// Two endpoints:
//   POST /compiler/run    — Run code against user-provided input (playground mode)
//   POST /compiler/submit — Run code against hidden test cases and report verdict
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs/promises');
const axios = require('axios');
const { executeInDocker, normalizeLanguage } = require('../utils/dockerExecutor');

// ── Configuration ──
// MAX_CODE_SIZE: Prevents users from submitting absurdly large code files (default 100KB)
const MAX_CODE_SIZE = (parseInt(process.env.MAX_CODE_SIZE_KB) || 100) * 1024;
// EXECUTION_TIMEOUT: Maximum time a program can run before being killed (default 10s)
const EXECUTION_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT) || 10000;

/**
 * Normalize program output for comparison.
 *
 * Why this is necessary:
 * - Trailing newlines: printf("hello\n") vs printf("hello") should both be accepted
 * - Windows line endings: \r\n from Windows Docker should match \n in test cases
 * - Trailing whitespace: "hello " should match "hello"
 * - Multiple spaces: "1  2" should match "1 2" (common in formatted output)
 * - Empty lines: blank lines between output should be ignored
 *
 * @param {string} str - Raw program output
 * @returns {string} Normalized output for comparison
 */
const normalizeOutput = (str) => {
  return String(str || '')
    .trim()                                  // Remove leading/trailing whitespace
    .split(/\r?\n/)                          // Split by newlines (Unix or Windows)
    .map((line) => line.trim().replace(/\s+/g, ' '))  // Collapse multiple spaces per line
    .filter(Boolean)                         // Remove empty lines
    .join('\n');                              // Rejoin with Unix newlines
};

/**
 * Report the verdict of a submission back to the main backend.
 *
 * This is inter-service communication: the compiler service tells the backend
 * "user X got verdict Y on problem Z". The backend then:
 * 1. Stores the submission in the database
 * 2. Updates the user's solvedProblems array (if accepted)
 *
 * The user's cookie is forwarded so the backend can authenticate who made
 * the submission (the compiler doesn't have its own auth — it trusts the cookie).
 *
 * @param {string} cookie - The user's auth cookie (forwarded from original request)
 * @param {string} problemId - MongoDB ObjectId of the problem
 * @param {string} verdict - The verdict string (e.g., "✅ Accepted")
 * @param {string} code - The submitted source code
 * @param {string} language - Programming language used
 */
const reportVerdict = async (cookie, problemId, verdict, code, language) => {
  try {
    await axios.post(
      `${process.env.MAIN_BACKEND_API_URL}/api/submission/verdict`,
      { problemId, verdict, code, language },
      { headers: { Cookie: cookie } }
    );
  } catch (error) {
    console.error('Failed to report verdict:', error.message);
  }
};

/**
 * POST /compiler/run — Execute code in playground mode
 *
 * Used when the user clicks "Run" — runs their code against custom input
 * and returns the raw output. No judging, no verdict.
 */
exports.runCode = async (req, res) => {
  const { language = 'cpp', code, input = '' } = req.body;

  // Validate: code is required
  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }

  // Validate: code size limit (prevents uploading huge files)
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE) {
    return res.status(400).json({ error: `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB` });
  }

  try {
    // Execute in Docker sandbox — returns { stdout, stderr, exitCode, executionTimeMs }
    const result = await executeInDocker(language, code, input, EXECUTION_TIMEOUT);

    // If there's stderr and non-zero exit, it's a runtime error
    if (result.stderr && result.exitCode !== 0) {
      const pretty = `❌ Runtime Error:\n${result.stderr}`;
      return res.json({ output: pretty });
    }

    // Normal output — return stdout
    return res.json({ output: result.stdout || '' });
  } catch (error) {
    // Docker executor throws typed errors:
    // { type: 'compile', message: '...' } — compilation failed
    // { type: 'timeout', message: '...' } — execution exceeded time limit
    // { type: 'runtime', message: '...' } — catch-all for other errors
    const pretty = `❌ ${
      error.type === 'compile'
        ? 'Compile Error'
        : error.type === 'timeout'
          ? 'Time Limit Exceeded'
          : 'Runtime Error'
    }:\n${error.message}`;
    return res.json({ output: pretty });
  }
};

/**
 * POST /compiler/submit — Judge code against hidden test cases
 *
 * Used when the user clicks "Submit" — runs their code against ALL hidden
 * test cases for the problem and reports a verdict.
 *
 * Flow:
 * 1. Fetch the full problem (with hidden test cases) from the backend
 *    using the X-Judge-Service-Key header for authentication
 * 2. Run code against each test case sequentially
 * 3. If ANY test case fails → return the failure verdict immediately
 * 4. If ALL test cases pass → return "✅ Accepted"
 * 5. Report the verdict back to the backend for storage
 */
exports.submitCode = async (req, res) => {
  const { code, language = 'cpp', problemId } = req.body;
  const cookie = req.headers.cookie;

  // ── Validate required fields ──
  if (!code || !language || !problemId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE) {
    return res.status(400).json({ error: `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB` });
  }

  // ── Step 1: Fetch the problem with hidden test cases ──
  // The X-Judge-Service-Key header tells the backend "I'm the compiler service,
  // give me the full problem including hiddenTestCases". Without this key,
  // the backend strips hiddenTestCases from the response (security measure).
  let problem;
  try {
    const response = await axios.get(
      `${process.env.MAIN_BACKEND_API_URL}/api/problems/${problemId}`,
      {
        headers: {
          // Internal service key so backend returns hiddenTestCases for judging
          'X-Judge-Service-Key': process.env.JUDGE_SERVICE_KEY || '',
          ...(cookie ? { Cookie: cookie } : {}),
        }
      }
    );
    problem = response.data;
  } catch (error) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  // Normalize language (e.g., "c++" → "cpp", "python" → "py")
  const normalizedLang = normalizeLanguage(language);

  // ── Step 2-3: Run against each hidden test case ──
  // Sequential execution — stops at the first failure.
  // This is intentional: we don't want to execute all test cases if the first one fails.
  const totalTestCases = (problem.hiddenTestCases || []).length;

  for (const [index, testCase] of (problem.hiddenTestCases || []).entries()) {
    try {
      const result = await executeInDocker(normalizedLang, code, testCase.input, EXECUTION_TIMEOUT);

      // Runtime error — code crashed
      if (result.stderr && result.exitCode !== 0) {
        const verdict = `❌ Runtime Error:\n${result.stderr}`;
        await reportVerdict(cookie, problemId, verdict, code, normalizedLang);
        return res.json({ verdict, testCaseNumber: index + 1, totalTestCases });
      }

      // Wrong Answer — output doesn't match expected
      // normalizeOutput handles trailing whitespace, newlines, etc.
      if (normalizeOutput(result.stdout) !== normalizeOutput(testCase.output)) {
        await reportVerdict(cookie, problemId, '❌ Wrong Answer', code, normalizedLang);
        return res.json({
          verdict: '❌ Wrong Answer',
          testCaseNumber: index + 1,
          totalTestCases,
          failedTestCase: {
            input: testCase.input,
            expectedOutput: testCase.output,
            actualOutput: result.stdout,
          },
        });
      }
    } catch (error) {
      // Compile Error or Time Limit Exceeded
      const verdict = `❌ ${
        error.type === 'compile'
          ? 'Compile Error'
          : error.type === 'timeout'
            ? 'Time Limit Exceeded'
            : 'Runtime Error'
      }:\n${error.message}`;

      await reportVerdict(cookie, problemId, verdict, code, normalizedLang);
      return res.json({ verdict, testCaseNumber: index + 1, totalTestCases });
    }
  }

  // ── Step 4: All test cases passed! ──
  await reportVerdict(cookie, problemId, 'Accepted', code, normalizedLang);
  return res.json({ verdict: '✅ Accepted', totalTestCases });
};

