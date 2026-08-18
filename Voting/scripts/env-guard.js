/**
 * Refuse destructive DB / wipe scripts when production profile is active.
 */
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function isLocalMongo(uri) {
  if (!uri) return false;
  return (
    /127\.0\.0\.1|localhost/i.test(uri) &&
    !/mongodb\+srv:/i.test(uri)
  );
}

export function assertDestructiveAllowed(scriptLabel = "this script") {
  const markerPath = resolve(ROOT, ".env.active");
  const active = existsSync(markerPath)
    ? readFileSync(markerPath, "utf8").trim()
    : null;
  const appEnv = process.env.APP_ENV;
  const mongo = process.env.MONGODB_URI || "";

  const blocked =
    active === "production" ||
    appEnv === "production" ||
    !isLocalMongo(mongo);

  if (blocked) {
    console.error(`\n❌ Refusing to run ${scriptLabel} against a production-like environment.`);
    console.error(`   Active profile : ${active || "(unknown)"}`);
    console.error(`   APP_ENV        : ${appEnv || "(unset)"}`);
    console.error(`   MONGODB_URI    : ${mongo.replace(/\/\/([^@]+)@/, "//***@")}`);
    console.error(`\n   Switch to local first:`);
    console.error(`     yarn env:dev`);
    console.error(`   Local DB should be: mongodb://127.0.0.1:27017/blockvote_local\n`);
    process.exit(1);
  }
}
