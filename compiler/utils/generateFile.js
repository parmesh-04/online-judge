const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In Lambda, we must use /tmp directory for all file operations
const dirCodes = path.join(process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd(), 'tmp', 'codes');

const extensionForLanguage = (language) => {
  if (language === 'c') return 'c';
  if (language === 'cpp') return 'cpp';
  if (language === 'py') return 'py';
  if (language === 'java') return 'java';
  return language;
};

const detectJavaClassName = (code) => {
  const src = String(code || '');
  const publicClassMatch = src.match(/\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  if (publicClassMatch?.[1]) return publicClassMatch[1];

  const classMatch = src.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  if (classMatch?.[1]) return classMatch[1];

  return 'Main';
};

const generateFile = async (language, code) => {
  const normalizedLanguage = language || 'cpp';
  const jobId = uuidv4();

  if (normalizedLanguage === 'java') {
    const className = detectJavaClassName(code);
    const workDir = path.join(dirCodes, jobId);
    const filename = `${className}.${extensionForLanguage(normalizedLanguage)}`;
    const filePath = path.join(workDir, filename);

    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(filePath, code);

    return { jobId, filePath, language: normalizedLanguage, className, workDir };
  }

  const filename = `${jobId}.${extensionForLanguage(normalizedLanguage)}`;
  const filePath = path.join(dirCodes, filename);

  await fs.mkdir(dirCodes, { recursive: true });
  await fs.writeFile(filePath, code);

  return { jobId, filePath, language: normalizedLanguage };
};

module.exports = generateFile;
