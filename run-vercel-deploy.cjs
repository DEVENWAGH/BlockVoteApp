#!/usr/bin/env node
/**
 * Invokes deploy_to_vercel via Cursor MCP by emitting the full deploy args JSON.
 * The parent agent reads this output and passes it to CallMcpTool.
 */
const deployArgs = require('./vercel-deploy-args.cjs');
process.stdout.write(JSON.stringify(deployArgs));
