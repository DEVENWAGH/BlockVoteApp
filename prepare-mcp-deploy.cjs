const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, 'Voting', 'payload-compact.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

// Write MCP tool arguments to a file that can be passed to CallMcpTool
const mcpArgs = {
  target: payload.target,
  name: payload.name,
  teamId: payload.teamId,
  files: payload.files,
  projectSettings: payload.projectSettings,
};

const outPath = path.join(__dirname, 'Voting', 'mcp-call-args.json');
fs.writeFileSync(outPath, JSON.stringify(mcpArgs));
console.log('Wrote MCP args to', outPath, 'size', fs.statSync(outPath).size);
