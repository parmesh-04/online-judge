const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

// We use child_process.exec (promisified) to run shell commands like gcc/g++/python3/javac/java.
// exec() captures stdout/stderr for us, which is useful for returning program output and compiler errors.
// Note: exec() runs through a shell, so it is important to quote paths properly.
const execAsync = promisify(exec);

// Convert low-level process errors into a standard shape used by the controller.
// - If the process was killed by the Node timeout => Time Limit Exceeded
// - Otherwise => Runtime Error (use stderr if available)
const classifyError = (err) => {
  if (err?.killed) return { type: 'timeout', message: 'Time Limit Exceeded' };
  return { type: 'runtime', message: err?.stderr || err?.message || String(err) };
};

// Accepts various aliases and normalizes them into a small canonical set.
// This keeps the execution dispatch predictable even if callers send "c++" vs "cpp" etc.
const normalizeLanguage = (language) => {
  const l = String(language || '').toLowerCase().trim();
  if (l === 'c') return 'c';
  if (l === 'cpp' || l === 'c++') return 'cpp';
  if (l === 'py' || l === 'python') return 'py';
  if (l === 'java') return 'java';
  return l;
};

// executeCode is the core "engine" used by both /run and /submit.
// Inputs:
// - language: selected programming language
// - jobId: unique identifier for this execution (used for output binary file names)
// - filePath: where the source code was written by generateFile()
// - inputFilePath: where stdin input was written by generateInputFile()
// - options: extra metadata (used primarily for Java)
// Output:
// - resolves to stdout string of the executed program
// - rejects with { type: 'compile' | 'runtime' | 'timeout', message }
const executeCode = async (language, jobId, filePath, inputFilePath, options = {}) => {
  const langKey = normalizeLanguage(language);

  // Compiled languages (C/C++) need a place to write the produced executable.
  // We keep binaries in tmp/outputs so we can clean them up if needed and avoid name collisions.
  // In Lambda, we must use /tmp directory for all file operations
  const baseDir = process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp' : process.cwd();
  const outDir = path.join(baseDir, 'tmp', 'outputs');
  await fs.mkdir(outDir, { recursive: true }); // Native FS is cleaner than exec(mkdir)

  const outputFile = path.join(outDir, `${jobId}.out`);

  // A small lookup table that tells us:
  // - how to compile (cmd)
  // - how to run (run)
  // For interpreted languages (Python), cmd is null.
  // Java is handled separately because it needs workDir/className and produces .class files.
  const config = {
    cpp: { cmd: `g++ "${filePath}" -O2 -std=c++17 -o "${outputFile}"`, run: `"${outputFile}"` },
    c:   { cmd: `gcc "${filePath}" -O2 -std=c11 -o "${outputFile}"`,   run: `"${outputFile}"` },
    py:  { cmd: null, run: `python3 "${filePath}"` },
    java: {
      cmd: null,
      run: null,
    }
  };

  const lang = config[langKey];
  if (!lang) throw { type: 'runtime', message: `Unsupported language: ${language}` };

  try {
    // -------------------------------------------------------
    // 1) Java path (compile + run)
    // -------------------------------------------------------
    // Java is special because:
    // - the filename must match the public class name (ClassName.java)
    // - javac generates .class files in the working directory
    // So generateFile() creates a per-job folder (workDir) and returns className.
    if (langKey === 'java') {
      const workDir = options.workDir;
      const className = options.className;
      if (!workDir || !className) {
        throw { type: 'runtime', message: 'Missing java execution metadata' };
      }

      // Compile: javac ClassName.java (inside workDir)
      // We set cwd=workDir so javac can find the .java file and emit .class files there.
      try {
        await execAsync(`javac "${className}.java"`, {
          cwd: workDir,
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        });
      } catch (e) {
        throw { type: 'compile', message: e?.stderr || e?.message || String(e) };
      }

      // Run: java -cp workDir ClassName < inputFile
      // -cp sets the classpath so java can find ClassName.class in workDir.
      // < inputFilePath feeds stdin to the program.
      const { stdout } = await execAsync(
        `java -cp "${workDir}" ${className} < "${inputFilePath}"`,
        {
          timeout: 2000,
          maxBuffer: 1024 * 1024,
        }
      );

      return stdout || '';
    }

    // -------------------------------------------------------
    // 2) Non-Java path
    // -------------------------------------------------------
    // For C/C++ we compile first (gcc/g++ -> output binary), then execute.
    // For Python we skip compilation and execute directly.
    if (lang.cmd) {
      // Compile step for C/C++.
      try {
        await execAsync(lang.cmd, { maxBuffer: 1024 * 1024 });
      } catch (e) {
        throw { type: 'compile', message: e?.stderr || e?.message || String(e) };
      }
    }

    // Execute step.
    // We always run with stdin redirection so user input behaves like it does in a terminal:
    //   program < input.txt
    // A timeout is enforced to protect against infinite loops.
    const { stdout } = await execAsync(`${lang.run} < "${inputFilePath}"`, {
      timeout: 2000,
      maxBuffer: 1024 * 1024,
    });

    return stdout || '';
  } catch (error) {
    // If we threw a structured error ({ type, message }) above, keep it.
    // Otherwise convert raw exec errors into runtime/timeout.
    throw error.type ? error : classifyError(error);
  }
};

module.exports = { executeCode };