const fs = require('fs/promises');
const axios = require('axios');

const generateFile = require('../utils/generateFile');
const generateInputFile = require('../utils/generateInputFile');
const { executeCode } = require('../utils/executeCode');

const normalizeOutput = (str) => {
  return String(str || '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');
};

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

exports.runCode = async (req, res) => {
  const { language = 'cpp', code, input = '' } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }

  const { jobId, filePath, language: normalizedLanguage, workDir, className } = await generateFile(language, code);
  const inputFilePath = await generateInputFile(input);

  try {
    const output = await executeCode(normalizedLanguage, jobId, filePath, inputFilePath, {
      workDir,
      className,
    });
    return res.json({ output });
  } catch (error) {
    const pretty = `❌ ${
      error.type === 'compile'
        ? 'Compile Error'
        : error.type === 'timeout'
          ? 'Time Limit Exceeded'
          : 'Runtime Error'
    }:\n${error.message}`;
    return res.json({ output: pretty });
  } finally {
    await Promise.all([
      fs.unlink(filePath).catch(() => {}),
      fs.unlink(inputFilePath).catch(() => {}),
    ]);

    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};

exports.submitCode = async (req, res) => {
  const { code, language = 'cpp', problemId } = req.body;
  const cookie = req.headers.cookie;

  if (!code || !language || !problemId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let problem;
  try {
    const response = await axios.get(
      `${process.env.MAIN_BACKEND_API_URL}/api/problems/${problemId}`,
      cookie ? { headers: { Cookie: cookie } } : undefined
    );
    problem = response.data;
  } catch (error) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  for (const [index, testCase] of (problem.hiddenTestCases || []).entries()) {
    const { jobId, filePath, language: normalizedLanguage, workDir, className } = await generateFile(language, code);
    const inputFilePath = await generateInputFile(testCase.input);

    try {
      const output = await executeCode(normalizedLanguage, jobId, filePath, inputFilePath, {
        workDir,
        className,
      });

      if (normalizeOutput(output) !== normalizeOutput(testCase.output)) {
        await reportVerdict(cookie, problemId, '❌ Wrong Answer', code, normalizedLanguage);
        return res.json({
          verdict: '❌ Wrong Answer',
          testCaseNumber: index + 1,
          failedTestCase: {
            input: testCase.input,
            expectedOutput: testCase.output,
            actualOutput: output,
          },
        });
      }
    } catch (error) {
      const verdict = `❌ ${
        error.type === 'compile'
          ? 'Compile Error'
          : error.type === 'timeout'
            ? 'Time Limit Exceeded'
            : 'Runtime Error'
      }:\n${error.message}`;

      await reportVerdict(cookie, problemId, verdict, code, normalizedLanguage);
      return res.json({ verdict });
    } finally {
      await Promise.all([
        fs.unlink(filePath).catch(() => {}),
        fs.unlink(inputFilePath).catch(() => {}),
      ]);

      if (workDir) {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  await reportVerdict(cookie, problemId, 'Accepted', code, language);
  return res.json({ verdict: '✅ Accepted' });
};
