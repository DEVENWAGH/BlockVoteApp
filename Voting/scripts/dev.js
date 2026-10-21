/**
 * scripts/dev.js
 *
 * Boots the full local development environment:
 * 1. Starts Hardhat node on 0.0.0.0:8545
 * 2. Waits for node, resets DB, and deploys contracts via wait-and-deploy.js
 * 3. Starts Next.js on 0.0.0.0:3000
 */
import { spawn } from 'node:child_process';

const hardhat = spawn('npx', ['hardhat', 'node', '--hostname', '0.0.0.0'], {
  stdio: 'inherit',
  shell: true,
});

const deploy = spawn('node', ['scripts/wait-and-deploy.js'], {
  stdio: 'inherit',
  shell: true,
});

let nextProc = null;

deploy.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✨ Contract ready — launching Next.js dev server on http://localhost:3000...\n');
    nextProc = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000'], {
      stdio: 'inherit',
      shell: true,
    });
    nextProc.on('exit', (c) => process.exit(c || 0));
  } else {
    console.error(`❌ wait-and-deploy exited with code ${code}`);
    hardhat.kill();
    process.exit(code || 1);
  }
});

function cleanup() {
  if (hardhat) hardhat.kill();
  if (nextProc) nextProc.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
