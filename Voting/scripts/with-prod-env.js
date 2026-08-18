/**
 * Run a Hardhat CLI command with HARDHAT_ENV_FILE=.env.production
 * without replacing the active local .env (development).
 *
 * Usage: node scripts/with-prod-env.js run scripts/deployProxy.js --network sepolia
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prodEnv = resolve(root, ".env.production");

if (!existsSync(prodEnv)) {
  console.error("❌ Missing Voting/.env.production");
  console.error("   Optional local archive of Sepolia deploy keys / contract address.");
  console.error("   Production Next.js secrets stay on Vercel — this file is only for yarn deploy:sepolia.");
  console.error("   Copy .env.production.example → .env.production and add deployer/relay/guardian keys + SEPOLIA_RPC_URL.");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node scripts/with-prod-env.js <hardhat args...>");
  process.exit(1);
}

const env = {
  ...process.env,
  HARDHAT_ENV_FILE: prodEnv,
};

const result = spawnSync("npx", ["hardhat", ...args], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
