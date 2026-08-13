const fs = require('fs');
const path = require('path');

const argsPath = path.join(__dirname, 'Voting', 'mcp-call-args.json');
const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'));

// Emit deploy arguments as single JSON line for MCP consumption
process.stdout.write(JSON.stringify({
  target: args.target,
  name: args.name,
  teamId: args.teamId,
  files: args.files,
  projectSettings: args.projectSettings,
}));
