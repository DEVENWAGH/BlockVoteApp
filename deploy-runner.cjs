const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, 'Voting', 'payload-compact.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

// Output payload for MCP deploy_to_vercel
process.stdout.write(JSON.stringify(payload));
