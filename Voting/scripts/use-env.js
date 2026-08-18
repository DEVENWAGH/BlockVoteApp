/**
 * Local env management.
 *
 * Source of truth:
 *   .env.development  → what you run on this machine (Hardhat + local Mongo)
 *   .env              → active copy of development (used by Next / Hardhat local)
 *   .env.production   → optional local ARCHIVE only (Sepolia deploy keys, contract addrs)
 *                       Production app secrets live on Vercel — never activate this into .env
 *
 * Usage:
 *   node scripts/use-env.js init
 *   node scripts/use-env.js development
 *   node scripts/use-env.js status
 */
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEV_FILE = ".env.development";
const DEV_EXAMPLE = ".env.development.example";
const PROD_FILE = ".env.production";
const PROD_EXAMPLE = ".env.production.example";

const ACTIVE = resolve(ROOT, ".env");
const MARKER = resolve(ROOT, ".env.active");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readKey(filePath, key) {
  if (!existsSync(filePath)) return null;
  return parseEnv(readFileSync(filePath, "utf8"))[key] ?? null;
}

function setKey(text, key, value) {
  const regex = new RegExp(`^${key}=.*`, "m");
  if (regex.test(text)) return text.replace(regex, `${key}=${value}`);
  return text.trimEnd() + `\n${key}=${value}\n`;
}

function status() {
  const active = existsSync(MARKER)
    ? readFileSync(MARKER, "utf8").trim()
    : "unknown";
  console.log("Active (local) profile :", active);
  console.log("APP_ENV                :", readKey(ACTIVE, "APP_ENV") || "(missing)");
  console.log("NEXTAUTH_URL           :", readKey(ACTIVE, "NEXTAUTH_URL") || "(missing)");
  const mongo = readKey(ACTIVE, "MONGODB_URI");
  console.log("MONGODB_URI            :", mongo ? mongo.replace(/\/\/([^@]+)@/, "//***@") : "(missing)");
  console.log("RPC_URL                :", readKey(ACTIVE, "RPC_URL") || readKey(ACTIVE, "NEXT_PUBLIC_RPC_URL") || "(missing)");
  console.log("CONTRACT               :", readKey(ACTIVE, "NEXT_PUBLIC_CONTRACT_ADDRESS") || "(missing)");
  console.log(
    "Local profile file     :",
    existsSync(resolve(ROOT, DEV_FILE)) ? `${DEV_FILE} OK` : `MISSING — copy ${DEV_EXAMPLE}`,
  );
  console.log(
    "Prod archive (unused)  :",
    existsSync(resolve(ROOT, PROD_FILE))
      ? `${PROD_FILE} present (Vercel is source of truth; used only by yarn deploy:sepolia)`
      : `optional — ${PROD_EXAMPLE}`,
  );
}

function activateDevelopment() {
  const profilePath = resolve(ROOT, DEV_FILE);
  if (!existsSync(profilePath)) {
    console.error(`❌ Missing ${DEV_FILE}`);
    console.error(`   Run: yarn env:init`);
    console.error(`   Or copy ${DEV_EXAMPLE} → ${DEV_FILE}`);
    process.exit(1);
  }

  if (existsSync(ACTIVE)) {
    copyFileSync(ACTIVE, resolve(ROOT, ".env.bak.development"));
  }

  copyFileSync(profilePath, ACTIVE);
  writeFileSync(MARKER, "development\n");

  const appEnv = readKey(ACTIVE, "APP_ENV");
  if (appEnv && appEnv !== "development") {
    console.warn(`⚠️  ${DEV_FILE} has APP_ENV=${appEnv}; expected development.`);
  }

  console.log(`✅ Local env active → ${DEV_FILE}`);
  console.log("   Production secrets stay on Vercel — not loaded here.");
  status();
}

function refuseProductionActivate() {
  console.log("Production is not activated on this machine.");
  console.log("  • App secrets / DB / guardians for https://www.devz.co.in → Vercel env");
  console.log(`  • Optional local archive: ${PROD_FILE} (for yarn deploy:sepolia only)`);
  console.log("  • Daily work: yarn env:dev");
  process.exit(0);
}

/**
 * Bootstrap .env.development for local use.
 * Optionally archives current Sepolia-ish values into .env.production (never activated).
 */
function init() {
  if (!existsSync(ACTIVE) && !existsSync(resolve(ROOT, DEV_FILE))) {
    console.error(`❌ No ${DEV_FILE} or .env found. Copy ${DEV_EXAMPLE} first.`);
    process.exit(1);
  }

  const prodPath = resolve(ROOT, PROD_FILE);
  const devPath = resolve(ROOT, DEV_FILE);
  const srcPath = existsSync(ACTIVE) ? ACTIVE : devPath;
  const src = parseEnv(readFileSync(srcPath, "utf8"));

  // Archive only — never used as active Next.js env
  if (!existsSync(prodPath) && existsSync(ACTIVE)) {
    let prod = readFileSync(ACTIVE, "utf8");
    prod = setKey(prod, "APP_ENV", "production");
    const nextAuth = parseEnv(prod).NEXTAUTH_URL || "";
    if (!nextAuth || /localhost|127\.0\.0\.1/i.test(nextAuth)) {
      prod = setKey(prod, "NEXTAUTH_URL", "https://www.devz.co.in");
    }
    prod =
      `# ARCHIVE ONLY — production runtime secrets live on Vercel.\n` +
      `# This file is optional locally; yarn deploy:sepolia may read it for wallet/RPC keys.\n` +
      `# Do NOT copy this over .env for next dev.\n\n` +
      prod;
    writeFileSync(prodPath, prod);
    console.log(`✅ Archived snapshot → ${PROD_FILE} (not activated; Vercel remains source of truth)`);
  } else if (existsSync(prodPath)) {
    console.log(`⏭️  ${PROD_FILE} already exists — left unchanged (archive only)`);
  }

  if (!existsSync(devPath)) {
    const examplePath = resolve(ROOT, DEV_EXAMPLE);
    let base = existsSync(examplePath)
      ? readFileSync(examplePath, "utf8")
      : "APP_ENV=development\n";

    const carry = [
      "JWT_SECRET",
      "SERVER_IDENTITY_SECRET",
      "AUTH_SECRET",
      "NEXTAUTH_SECRET",
      "SERVER_ENCRYPTION_KEY",
      "AWS_REGION",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_S3_BUCKET",
      "RESEND_API_KEY",
      "RESEND_FROM",
      "RESEND_FROM_EMAIL",
      "PINATA_JWT",
      "PINATA_GATEWAY",
      "PINATA_API_KEY",
      "PINATA_API_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "IMAGEKIT_PUBLIC_KEY",
      "IMAGEKIT_PRIVATE_KEY",
      "IMAGEKIT_URL_ENDPOINT",
      "GMAIL_USER",
      "GMAIL_APP_PASSWORD",
      "ADMIN_API_KEY",
      "NEXT_PUBLIC_ADMIN_ORGS_API_KEY",
    ];

    for (const key of carry) {
      if (src[key]) base = setKey(base, key, src[key]);
    }

    base = setKey(base, "APP_ENV", "development");
    base = setKey(base, "MONGODB_URI", "mongodb://127.0.0.1:27017/blockvote_local");
    base = setKey(base, "RPC_URL", "http://127.0.0.1:8545");
    base = setKey(base, "NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545");
    base = setKey(base, "NEXTAUTH_URL", "http://localhost:3000");
    base = setKey(base, "NEXT_PUBLIC_CONTRACT_ADDRESS", "");
    base = setKey(base, "CONTRACT_IMPL_ADDRESS", "");
    for (const k of [
      "DEPLOYER_PRIVATE_KEY",
      "ADMIN_RELAY_PRIVATE_KEY",
      "GUARDIAN_1_PRIVATE_KEY",
      "GUARDIAN_2_PRIVATE_KEY",
      "GUARDIAN_3_PRIVATE_KEY",
      "GAS_STATION_PRIVATE_KEY",
      "ADMIN_RELAY_ADDRESS",
      "GUARDIAN_1_ADDRESS",
      "GUARDIAN_2_ADDRESS",
      "GUARDIAN_3_ADDRESS",
      "NEXT_PUBLIC_GUARDIAN_1",
      "NEXT_PUBLIC_GUARDIAN_2",
      "NEXT_PUBLIC_GUARDIAN_3",
      "NEXT_PUBLIC_DEPLOYER_ADDRESS",
    ]) {
      base = setKey(base, k, "");
    }

    writeFileSync(devPath, base);
    console.log(`✅ Created ${DEV_FILE} (DB: blockvote_local)`);
  } else {
    console.log(`⏭️  ${DEV_FILE} already exists — left unchanged`);
  }

  console.log("\nLocal only: yarn env:dev");
  console.log("Production: manage env in Vercel dashboard for https://www.devz.co.in");
  activateDevelopment();
}

const cmd = process.argv[2];

if (cmd === "status") status();
else if (cmd === "init") init();
else if (cmd === "development" || cmd === "dev" || cmd === "local") activateDevelopment();
else if (cmd === "production" || cmd === "prod" || cmd === "sepolia") refuseProductionActivate();
else if (cmd === "sync") {
  const profilePath = resolve(ROOT, DEV_FILE);
  if (existsSync(ACTIVE)) {
    copyFileSync(ACTIVE, profilePath);
    writeFileSync(MARKER, "development\n");
    console.log(`✅ Synced .env → ${DEV_FILE}`);
  }
} else {
  console.log(`Usage:
  node scripts/use-env.js init
  node scripts/use-env.js development
  node scripts/use-env.js status

Production secrets: Vercel only. ${PROD_FILE} is optional archive.`);
  process.exit(cmd ? 1 : 0);
}
