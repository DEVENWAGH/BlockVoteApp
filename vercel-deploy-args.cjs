const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'Voting', 'mcp-deploy-args.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

const deployArgs = {
  target: 'preview',
  name: 'blockvote',
  teamId: 'team_34hQX9382vwpjQdHt9ABnaiC',
  files: data.files,
  projectSettings: {
    framework: 'nextjs',
    buildCommand: 'yarn build',
    installCommand: 'yarn install',
  },
};

module.exports = deployArgs;
