// ═══════════════════════════════════════════════════════════════════════
// compiler/utils/dockerExecutor.js — Docker-based code execution engine
// ═══════════════════════════════════════════════════════════════════════
//
// This module replaces the old child_process approach with isolated Docker
// containers for SECURE execution of untrusted user code.
//
// SECURITY MODEL:
// Each submission gets a FRESH container with these constraints:
//
//   NetworkMode: 'none'
//     → Prevents code from making HTTP requests, exfiltrating data,
//       or attacking other services on the network
//
//   Memory: 256MB, MemorySwap: 256MB
//     → Prevents memory bombs — malicious code allocating infinite RAM
//     → memswap must equal mem_limit to prevent swap exploitation
//
//   PidsLimit: 50
//     → Prevents fork bombs — malicious code calling fork() in a loop
//       to spawn unlimited child processes and crash the host
//     → NOTE: Not supported on Windows Docker Desktop (WSL2). Set to 0 (disabled).
//
//   ReadonlyRootfs: true
//     → Prevents code from writing to the container filesystem
//       (e.g., creating shell scripts, modifying system files)
//     → /tmp is mounted as a separate tmpfs with exec permission for compiled binaries
//     → NOTE: Not supported on Windows Docker Desktop. Conditionally disabled.
//
//   CapDrop: ['ALL']
//     → Drops ALL Linux capabilities (e.g., no CAP_SYS_ADMIN, no CAP_NET_RAW)
//     → The container can't do anything privileged
//
//   SecurityOpt: ['no-new-privileges']
//     → Prevents escalation via setuid/setgid binaries inside the container
//
// IMAGES:
//   C/C++:      judge-cpp:latest (custom alpine image, ~215MB)
//   Python:     python:3.11-slim (~130MB)
//   JavaScript: node:20-slim (~185MB)
//   Java:       openjdk:21-slim (~300MB)
//
// CONTAINER LIFECYCLE:
//   1. Create container → 2. Start → 3. Wait (with timeout) →
//   4. Read logs → 5. Manual remove → 6. Cleanup temp files
//
//   NOTE: AutoRemove is set to FALSE. We used to set it to true, but this
//   caused a race condition where Docker deleted the container before
//   container.logs() could read the output, resulting in a 409 error.
//   Now we manually call container.remove({ force: true }) after capturing logs.
// ═══════════════════════════════════════════════════════════════════════

const Docker = require('dockerode');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Docker Connection ──
// On Windows, Docker Desktop exposes a named pipe instead of a Unix socket.
// Detect platform and connect accordingly.
const getDockerOptions = () => {
  if (os.platform() === 'win32') {
    return { socketPath: '//./pipe/docker_engine' };
  }
  // In Docker-compose (Linux container), use the mounted socket
  return { socketPath: '/var/run/docker.sock' };
};

const docker = new Docker(getDockerOptions());

// ═══════════════════════════════════════════════════════════════════════
// Language Configuration — maps language to Docker image and commands
// ═══════════════════════════════════════════════════════════════════════
//
// For compiled languages (C/C++/Java):
//   compile: command that compiles the code, echoing __COMPILE_OK__ on success
//   run: command that runs the compiled binary
//   The __COMPILE_OK__ marker lets us distinguish compilation failures
//   from runtime errors by checking if the marker appears in stdout.
//
// For interpreted languages (Python/JavaScript):
//   compile: null (no compilation step)
//   run: command that directly executes the source file
const LANGUAGE_CONFIG = {
  cpp: {
    image: 'judge-cpp:latest',  // Custom alpine image with g++
    ext: 'cpp',
    compile: (file) => `g++ /sandbox/code.${file.ext} -O2 -std=c++17 -o /tmp/a.out 2>&1 && echo __COMPILE_OK__`,
    run: '/tmp/a.out',
  },
  c: {
    image: 'judge-cpp:latest',  // Same image as C++ (both use gcc)
    ext: 'c',
    compile: (file) => `gcc /sandbox/code.${file.ext} -O2 -std=c11 -o /tmp/a.out 2>&1 && echo __COMPILE_OK__`,
    run: '/tmp/a.out',
  },
  py: {
    image: 'python:3.11-slim',
    ext: 'py',
    compile: null,  // Interpreted — no compilation step
    run: 'python3 /sandbox/code.py',
  },
  python: {
    image: 'python:3.11-slim',
    ext: 'py',
    compile: null,
    run: 'python3 /sandbox/code.py',
  },
  java: {
    image: 'openjdk:21-slim',
    ext: 'java',
    compile: () => 'cp /sandbox/code.java /tmp/Main.java && javac /tmp/Main.java 2>&1 && echo __COMPILE_OK__',
    run: 'java -cp /tmp Main',
  },
  javascript: {
    image: 'node:20-slim',
    ext: 'js',
    compile: null,
    run: 'node /sandbox/code.js',
  },
  js: {
    image: 'node:20-slim',
    ext: 'js',
    compile: null,
    run: 'node /sandbox/code.js',
  },
};

/**
 * Normalize language aliases to canonical form.
 * e.g., "c++" → "cpp", "python" → "py"
 */
const normalizeLanguage = (language) => {
  const l = String(language || '').toLowerCase().trim();
  if (l === 'c++') return 'cpp';
  if (l === 'python') return 'py';
  return l;
};

/**
 * Execute code inside a Docker container with strict security constraints.
 *
 * @param {string} language   - Programming language (e.g., "cpp", "py")
 * @param {string} code       - Source code to execute
 * @param {string} input      - Stdin input for the program
 * @param {number} timeout    - Timeout in milliseconds (default: 10000)
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, executionTimeMs: number }>}
 * @throws {{ type: 'compile'|'timeout'|'runtime', message: string }}
 */
const executeInDocker = async (language, code, input = '', timeout = 10000) => {
  const lang = normalizeLanguage(language);
  const config = LANGUAGE_CONFIG[lang];

  if (!config) {
    throw { type: 'runtime', message: `Unsupported language: ${language}` };
  }

  // Generate a unique job ID and create temp directory on the HOST
  const jobId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), `judge-${jobId}`);
  const codeFile = path.join(tmpDir, `code.${config.ext}`);
  const inputFile = path.join(tmpDir, 'input.txt');

  let container = null;
  const startTime = Date.now();

  try {
    // ── Step 1: Write code and input to temp files on the host ──
    // These files will be bind-mounted READ-ONLY into the container at /sandbox/
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(codeFile, code);
    await fs.writeFile(inputFile, input || '');

    // ── Step 2: Build the shell command to run inside the container ──
    let shellCmd;
    if (config.compile) {
      // Compiled language: compile first, then run with stdin redirected from /sandbox/input.txt
      const compileCmd = typeof config.compile === 'function' ? config.compile(config) : config.compile;
      shellCmd = `${compileCmd} && ${config.run} < /sandbox/input.txt`;
    } else {
      // Interpreted language: run directly with stdin
      shellCmd = `${config.run} < /sandbox/input.txt`;
    }

    // ── Step 3: Create Docker container with security constraints ──
    // Windows Docker Desktop needs Windows-style path converted to /drive/path format
    // for bind mount paths (e.g., C:\Users\... → /c/Users/...)
    const sandboxMount = os.platform() === 'win32'
      ? tmpDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)
      : tmpDir;

    const isWindows = os.platform() === 'win32';

    container = await docker.createContainer({
      Image: config.image,
      Cmd: ['sh', '-c', shellCmd],
      HostConfig: {
        // ── Memory Limits ──
        Memory: 256 * 1024 * 1024,       // 256MB hard limit
        MemorySwap: 256 * 1024 * 1024,    // Same as Memory → prevents swap exploitation

        // ── CPU Limits ──
        CpuPeriod: 100000,                // CPU scheduling period (microseconds)
        CpuQuota: 50000,                   // 50% of one CPU core (50000/100000)

        // ── Network Isolation ──
        // Completely disables networking inside the container.
        // The code cannot make HTTP requests, ping, or access any external service.
        NetworkMode: 'none',

        // ── Filesystem Security (Linux only) ──
        // ReadonlyRootfs prevents writing anywhere except /tmp (which is a tmpfs).
        // Windows Docker Desktop doesn't support these features.
        ...(isWindows ? {} : {
          ReadonlyRootfs: true,              // Read-only container filesystem
          Tmpfs: { '/tmp': 'size=64m,exec' }, // Writable /tmp for compiled binaries
        }),

        // ── Capability Restrictions ──
        CapDrop: ['ALL'],                  // Drop ALL Linux capabilities (no privileges)
        SecurityOpt: isWindows ? [] : ['no-new-privileges'], // Prevent privilege escalation

        // ── AutoRemove: false ──
        // We INTENTIONALLY don't auto-remove. AutoRemove:true caused a race condition:
        // Docker deleted the container before container.logs() could read output (409 error).
        // We now manually call container.remove() after capturing logs.
        AutoRemove: false,

        // ── PID Limit ──
        // Prevents fork bombs by limiting the number of processes in the container.
        // Windows Docker Desktop (WSL2) does not support PidsLimit — set to 0 (disabled).
        PidsLimit: isWindows ? 0 : 50,

        // ── Bind Mount ──
        // Mount the host temp directory as /sandbox inside the container, READ-ONLY.
        // The container can only read the code and input files — not write to them.
        Binds: [`${sandboxMount}:/sandbox:ro`],
      },
      AttachStdout: true,
      AttachStderr: true,
    });

    // ── Step 4: Start the container ──
    await container.start();

    // ── Step 5: Wait for container to finish (with timeout) ──
    // Race between the container completing naturally and the timeout.
    // If timeout fires first, we kill the container and throw a timeout error.
    const waitPromise = container.wait();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject({ type: 'timeout', message: 'Time Limit Exceeded' });
        // Background kill - do not await here so we reject immediately
        if (container) {
          container.kill().catch(() => {});
        }
      }, timeout);
    });

    let result;
    try {
      result = await Promise.race([waitPromise, timeoutPromise]);
    } catch (err) {
      if (err.type === 'timeout') throw err;
      throw { type: 'runtime', message: err.message || String(err) };
    }

    // ── Step 6: Capture stdout and stderr from container logs ──
    let logs;
    try {
      logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,  // Don't stream — just get all logs at once
      });
    } catch (logErr) {
      // If logs failed (e.g. container already gone), return empty buffer
      logs = Buffer.alloc(0);
    }

    // ── Step 7: Remove the container now that we have the logs ──
    try { await container.remove({ force: true }); } catch (_) {}
    container = null; // Prevent double-remove in finally block

    // ── Step 8: Parse the Docker log output ──
    // Docker logs come as a Buffer with multiplexed streams.
    // Each frame has an 8-byte header: [stream_type, 0, 0, 0, size (4 bytes BE)]
    const rawOutput = parseLogs(logs);
    const executionTimeMs = Date.now() - startTime;

    // Cap output to 256KB to prevent OOM if the user's program prints millions of lines
    const MAX_OUTPUT = 256 * 1024;
    const cappedStdout = rawOutput.stdout.slice(0, MAX_OUTPUT);
    const cappedStderr = rawOutput.stderr.slice(0, MAX_OUTPUT);

    // ── Step 9: Check for compile errors (compiled languages only) ──
    // If the __COMPILE_OK__ marker is missing from stdout, compilation failed.
    // The stdout/stderr will contain the compiler error messages.
    if (config.compile && !cappedStdout.includes('__COMPILE_OK__')) {
      throw {
        type: 'compile',
        message: (cappedStdout + cappedStderr).slice(0, 2000),
      };
    }

    // Remove the __COMPILE_OK__ marker from output (it's not part of the program's output)
    const stdout = cappedStdout.replace('__COMPILE_OK__\n', '').replace('__COMPILE_OK__', '');

    return {
      stdout: stdout.trim(),
      stderr: cappedStderr.trim(),
      exitCode: result.StatusCode,
      executionTimeMs,
    };
  } finally {
    // ── Cleanup ──
    // Force-remove container if still alive (e.g., on timeout or unexpected error)
    if (container) {
      try { await container.remove({ force: true }); } catch (_) {}
    }
    // Clean up host temp files (code and input)
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors — temp files will be cleaned by OS eventually
    }
  }
};

/**
 * Parse Docker multiplexed log stream.
 *
 * Docker logs use a custom binary protocol with 8-byte frame headers:
 *   Byte 0:   Stream type (1 = stdout, 2 = stderr)
 *   Bytes 1-3: Reserved (zeros)
 *   Bytes 4-7: Frame size as big-endian uint32
 *   Bytes 8+:  Frame payload (actual log text)
 *
 * This parser separates stdout and stderr by reading stream types.
 *
 * @param {Buffer} buffer - Raw Docker log output
 * @returns {{ stdout: string, stderr: string }}
 */
function parseLogs(buffer) {
  let stdout = '';
  let stderr = '';

  if (!Buffer.isBuffer(buffer)) {
    // If it's a string (shouldn't happen, but defensive), just return as stdout
    return { stdout: String(buffer || ''), stderr: '' };
  }

  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      // Not enough bytes for a header — treat remaining bytes as stdout
      stdout += buffer.slice(offset).toString('utf8');
      break;
    }

    const streamType = buffer[offset];           // 1 = stdout, 2 = stderr
    const size = buffer.readUInt32BE(offset + 4); // Payload size
    offset += 8;                                  // Skip past header

    if (offset + size > buffer.length) {
      // Partial frame — read whatever's left
      const text = buffer.slice(offset).toString('utf8');
      if (streamType === 2) stderr += text;
      else stdout += text;
      break;
    }

    const text = buffer.slice(offset, offset + size).toString('utf8');
    if (streamType === 2) {
      stderr += text;
    } else {
      stdout += text;
    }
    offset += size;
  }

  return { stdout, stderr };
}

/**
 * Verify Docker is available and responsive.
 * Called once at startup. If Docker isn't running, exits with a clear error.
 */
const verifyDocker = async () => {
  try {
    await docker.ping();
    console.log('✅ Docker connection verified');
  } catch (error) {
    console.error('❌ Docker is not available. The compiler service requires Docker to run.');
    console.error('   Make sure Docker is installed and the Docker socket is accessible.');
    console.error('   Error:', error.message);
    process.exit(1);
  }
};

module.exports = { executeInDocker, verifyDocker, normalizeLanguage };
