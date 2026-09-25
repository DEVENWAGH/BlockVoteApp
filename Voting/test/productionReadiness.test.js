/**
 * Production-readiness tests: env handling, guardian/internal auth, links,
 * and a source scan that keeps beta/dev leftovers out of shipped code.
 * Run: yarn test
 */
import { expect } from 'chai';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  isProduction, readServerEnv, getIdentitySecret, getJwtSecret, getStationSecret, getPublicBaseUrl, getRpcUrl,
} from '../lib/serverEnv.js';
import { isValidInternalKey } from '../lib/internalAuth.js';
import { guardianActionMessage, signGuardianAction, GUARDIAN_SIGNATURE_TTL_MS } from '../lib/guardianMessage.js';
import { checkGuardianSignature } from '../lib/guardianAuth.js';
import { getVoteDeepLink, getVoteInviteUrl, getAndroidIntentUrl } from '../lib/appLinks.js';
import { describeVotingHours, getVotingHoursConfig } from '../lib/votingWindow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = { NODE_ENV: 'production' };
const DEV = { NODE_ENV: 'development' };

describe('serverEnv — secrets and URLs', () => {
  it('E1 detects production only for NODE_ENV=production', () => {
    expect(isProduction(PROD)).to.equal(true);
    expect(isProduction(DEV)).to.equal(false);
    expect(isProduction({})).to.equal(false);
  });

  it('E2 uses the dev fallback outside production', () => {
    expect(getJwtSecret(DEV)).to.be.a('string').and.not.empty;
    expect(getIdentitySecret(DEV)).to.be.a('string').and.not.empty;
    expect(getPublicBaseUrl(DEV)).to.equal('http://localhost:3000');
  });

  it('E3 throws in production when a required secret is missing', () => {
    expect(() => getJwtSecret(PROD)).to.throw(/JWT_SECRET must be set in production/);
    expect(() => getIdentitySecret(PROD)).to.throw(/SERVER_IDENTITY_SECRET/);
    expect(() => getStationSecret(PROD)).to.throw(/STATION_SESSION_SECRET or JWT_SECRET/);
    expect(() => getPublicBaseUrl(PROD)).to.throw(/must be set in production/);
  });

  it('E4 never falls back to a dev value in production', () => {
    expect(getJwtSecret({ ...PROD, JWT_SECRET: 'real-secret' })).to.equal('real-secret');
    expect(() => readServerEnv(['X'], 'fallback', { ...PROD, X: '   ' })).to.throw();
  });

  it('E5 station secret prefers STATION_SESSION_SECRET over JWT_SECRET', () => {
    expect(getStationSecret({ ...PROD, JWT_SECRET: 'jwt', STATION_SESSION_SECRET: 'st' })).to.equal('st');
    expect(getStationSecret({ ...PROD, JWT_SECRET: 'jwt' })).to.equal('jwt');
  });

  it('E6 public URL follows precedence and strips trailing slashes', () => {
    expect(getPublicBaseUrl({
      ...PROD,
      NEXT_PUBLIC_APP_URL: 'https://www.devz.co.in/',
      NEXTAUTH_URL: 'https://other.example',
    })).to.equal('https://www.devz.co.in');
    expect(getPublicBaseUrl({ ...PROD, NEXTAUTH_URL: 'https://www.devz.co.in//' })).to.equal('https://www.devz.co.in');
  });

  it('E7 RPC URL: local chain in dev, required in production', () => {
    expect(getRpcUrl(DEV)).to.equal('http://127.0.0.1:8545');
    expect(() => getRpcUrl(PROD)).to.throw(/RPC_URL or NEXT_PUBLIC_RPC_URL/);
    expect(getRpcUrl({ ...PROD, NEXT_PUBLIC_RPC_URL: 'https://rpc.example' })).to.equal('https://rpc.example');
  });
});

describe('internalAuth — server-to-server API key', () => {
  it('I1 accepts only an exact key match', () => {
    expect(isValidInternalKey('k3y-value', 'k3y-value')).to.equal(true);
    expect(isValidInternalKey('k3y-valuE', 'k3y-value')).to.equal(false);
    expect(isValidInternalKey('k3y', 'k3y-value')).to.equal(false);
  });

  it('I2 denies everything when ADMIN_API_KEY is unset', () => {
    expect(isValidInternalKey('', '')).to.equal(false);
    expect(isValidInternalKey('anything', undefined)).to.equal(false);
    expect(isValidInternalKey('', 'k3y-value')).to.equal(false);
  });
});

describe('guardianAuth — signed guardian actions', () => {
  const guardian = ethers.Wallet.createRandom();
  const outsider = ethers.Wallet.createRandom();
  const guardians = [guardian.address.toLowerCase()];
  const action = 'election:approve';
  const target = '0xabc123';

  it('G1 accepts a fresh signature from a guardian and returns its address', async () => {
    const proof = await signGuardianAction(guardian, { action, target });
    const res = checkGuardianSignature({ action, target, ...proof }, guardians);
    expect(res.ok).to.equal(true);
    expect(res.address).to.equal(guardian.address);
  });

  it('G2 rejects a non-guardian signer', async () => {
    const proof = await signGuardianAction(outsider, { action, target });
    const res = checkGuardianSignature({ action, target, ...proof }, guardians);
    expect(res.ok).to.equal(false);
    expect(res.error).to.match(/guardian wallet required/);
  });

  it('G3 rejects a signature replayed for a different election or action', async () => {
    const proof = await signGuardianAction(guardian, { action, target });
    expect(checkGuardianSignature({ action, target: '0xother', ...proof }, guardians).ok).to.equal(false);
    expect(checkGuardianSignature({ action: 'data:wipe', target, ...proof }, guardians).ok).to.equal(false);
  });

  it('G4 rejects an expired signature', async () => {
    const issuedAt = Date.now() - GUARDIAN_SIGNATURE_TTL_MS - 1000;
    const signature = await guardian.signMessage(guardianActionMessage({ action, target, issuedAt }));
    const res = checkGuardianSignature({ action, target, issuedAt, signature }, guardians);
    expect(res.ok).to.equal(false);
    expect(res.error).to.match(/expired/);
  });

  it('G5 rejects a missing or malformed signature', () => {
    expect(checkGuardianSignature({ action, target, issuedAt: Date.now() }, guardians).ok).to.equal(false);
    expect(checkGuardianSignature({ action, target, issuedAt: Date.now(), signature: '0x1234' }, guardians).ok)
      .to.equal(false);
  });

  it('G6 refuses to sign without a connected wallet', async () => {
    let err;
    try { await signGuardianAction(null, { action }); } catch (e) { err = e; }
    expect(err?.message).to.match(/Connect your guardian wallet/);
  });
});

describe('appLinks — invite and deep links', () => {
  const saved = { ...process.env };
  before(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://www.devz.co.in/'; });
  after(() => { process.env = saved; });

  it('L1 invite URL uses the public base URL and encodes path segments', () => {
    const url = getVoteInviteUrl('0xabc', { orgName: 'My Org', electionTitle: 'Class Rep / 2026' });
    expect(url).to.equal('https://www.devz.co.in/org/My%20Org/election/Class%20Rep%20%2F%202026/0xabc');
    expect(url).to.not.include('web=1');
  });

  it('L2 invite URL requires org, title and election id', () => {
    expect(() => getVoteInviteUrl('0xabc', { orgName: 'Org' })).to.throw(/Missing/);
  });

  it('L3 deep link and Android intent target the app package', () => {
    expect(getVoteDeepLink('0xabc')).to.equal('blockvote://vote/0xabc');
    expect(getVoteDeepLink()).to.equal('blockvote://vote/');
    expect(getAndroidIntentUrl('0xabc')).to.equal(
      'intent://vote/0xabc#Intent;scheme=blockvote;package=com.blockvote.android;end',
    );
  });
});

describe('votingWindow — hours label', () => {
  it('H1 shows an all-day label when open and close are equal', () => {
    const cfg = getVotingHoursConfig({ VOTING_OPEN_TIME: '00:00', VOTING_CLOSE_TIME: '00:00' });
    expect(describeVotingHours(cfg)).to.match(/^Open all day/);
  });
});

describe('source scan — no beta/dev leftovers in shipped code', () => {
  const SCAN_DIRS = ['app', 'components', 'lib', 'context'];
  const EXT = /\.(js|jsx|ts|tsx)$/;

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'contracts') walk(full, out);
      } else if (EXT.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

  function offenders(pattern, allow = []) {
    return files
      .filter((f) => !allow.includes(rel(f)))
      .filter((f) => pattern.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
  }

  it('S1 scans a meaningful number of files', () => {
    expect(files.length).to.be.greaterThan(50);
  });

  it('S2 no "beta" labels in UI or API text', () => {
    expect(offenders(/\bbeta\b/i)).to.deep.equal([]);
  });

  it('S3 no Hardhat default accounts or private keys', () => {
    expect(offenders(/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266|ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcaa/i))
      .to.deep.equal([]);
  });

  it('S4 dev secret fallbacks live only in lib/serverEnv.js', () => {
    expect(offenders(/dev-(jwt|identity)-secret/, ['lib/serverEnv.js'])).to.deep.equal([]);
  });

  it('S5 no hard-coded localhost / LAN base URLs outside serverEnv', () => {
    expect(offenders(/https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/, ['lib/serverEnv.js', 'lib/publicEnv.js']))
      .to.deep.equal([]);
  });

  it('S7 routes that populate createdBy register the Admin model (cold serverless starts)', () => {
    const missing = files
      .filter((f) => /populate\(\s*\{?\s*(path:\s*)?['"]createdBy['"]/.test(fs.readFileSync(f, 'utf8')))
      .filter((f) => !/models\/Admin['"]/.test(fs.readFileSync(f, 'utf8')))
      .map(rel);
    expect(missing).to.deep.equal([]);
  });

  it('S6 no simulated / demo-mode toggles', () => {
    expect(offenders(/USE_DEMO_DATA|web=1|X-Preflight-Source/)).to.deep.equal([]);
  });
});
