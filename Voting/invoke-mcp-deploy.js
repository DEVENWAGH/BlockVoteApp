/**
 * Reads payload-compact.json and prints deploy args for MCP deploy_to_vercel.
 * Usage: node invoke-mcp-deploy.js
 */
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, 'payload-compact.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

// Output deploy arguments as JSON to stdout for MCP tool consumption
process.stdout.write(JSON.stringify(payload));
