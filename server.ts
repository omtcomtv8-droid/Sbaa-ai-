/**
 * Pocket Option Signal Engine - Application Entrypoint
 * Full-stack Vite + Express Server Bootstrap
 *
 * Ensures seamless execution under both Node.js (Cloud Run production)
 * and tsx (development), resolving TypeScript modules and specifiers.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const isTsx =
  process.execArgv.some((arg) => arg.includes('tsx')) ||
  process.env.__TSX_BOOTSTRAPPED__ === 'true';

if (!isTsx) {
  // Plain 'node server.ts' was called (Cloud Run production deployment).
  // Re-launch with Node 22's --import tsx loader so TypeScript module
  // resolution (including extensionless relative imports) works correctly.
  process.env.__TSX_BOOTSTRAPPED__ = 'true';
  const currentFile = fileURLToPath(import.meta.url);
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', currentFile, ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {}
  };

  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('SIGINT', () => forwardSignal('SIGINT'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
} else {
  // Inside tsx environment: dynamically load the server application.
  await import('./serverMain.ts');
}
