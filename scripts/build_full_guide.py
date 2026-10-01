# -*- coding: utf-8 -*-
"""
Master generator for BlockVote Viva Preparation Guide and IEEE Research Paper Analysis.
Generates docs/BlockVote_Viva_Preparation_Guide.html and compiles to docs/BlockVote_Viva_Preparation_Guide.pdf.
"""
import os
import subprocess
import sys

def main():
    html_path = os.path.abspath("docs/BlockVote_Viva_Preparation_Guide.html")
    pdf_path = os.path.abspath("docs/BlockVote_Viva_Preparation_Guide.pdf")
    os.makedirs(os.path.dirname(html_path), exist_ok=True)

    print("Generating comprehensive BlockVote viva guide HTML...")

    # We import the styles from viva_sections_data
    from viva_sections_data import CSS_STYLES

    with open(html_path, "w", encoding="utf-8") as f:
        # Write HTML Header and Styles
        f.write(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BlockVote - Master MCA Project Viva & Research Paper Guide</title>
<style>
{CSS_STYLES}
</style>
</head>
<body>

<div class="header-banner">
  <h1>BlockVote: Master MCA Project Viva Guide & IEEE Research Paper Analysis</h1>
  <p><strong>Candidate / Lead Author:</strong> Deven Wagh (Department of Computer Applications, Pillai HOC College of Engineering & Technology, Rasayani)</p>
  <p><strong>Faculty Guide:</strong> Dr. Abhijeet More | <strong>Co-Authors:</strong> Kalpit Mhatre, Rohit Zagade</p>
  <p><strong>Paper Title:</strong> BlockVote: A Gasless, Coercion-Mitigating Decentralized E-Voting System Combining Sensor-Driven Biometric Liveness, UUPS Multi-Signature Governance, and On-Chain Keccak-256 Nullifiers</p>
</div>

<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-val">21,609</div>
    <div class="stat-lbl">Lines of Code (182 Files)</div>
  </div>
  <div class="stat-card">
    <div class="stat-val">190 / 190</div>
    <div class="stat-lbl">Passing Tests (30 Attacks)</div>
  </div>
  <div class="stat-card">
    <div class="stat-val">89,946</div>
    <div class="stat-lbl">Gas Per Ballot (V3)</div>
  </div>
  <div class="stat-card">
    <div class="stat-val">114</div>
    <div class="stat-lbl">Live Sepolia Txs Analyzed</div>
  </div>
</div>
""")

        # SECTION 1: RESEARCH PAPER EXHAUSTIVE ANALYSIS
        f.write("""
<h2>RESEARCH PAPER ANALYSIS: BlockVote_IEEE_merged.pdf</h2>
<p>This section provides a thorough, part-by-part explanation of the research paper written for this project (<em>BlockVote: A Gasless, Coercion-Mitigating Decentralized E-Voting System Combining Sensor-Driven Biometric Liveness, UUPS Multi-Signature Governance, and On-Chain Keccak-256 Nullifiers</em> by Deven Wagh, Kalpit Mhatre, Rohit Zagade, and Dr. Abhijeet More, Pillai HOC College of Engineering & Technology).</p>

<h3>1. Paper Abstract & Core Problem Formulation</h3>
<p><strong>Motivation:</strong> Conventional paper ballots suffer from physical ballot-box snatching, high logistical overheads, manual counting delays, and human bias. Conversely, existing electronic voting machines (EVMs) require physical presence, while traditional web-based e-voting portals rely on centralized databases (e.g. MySQL/PostgreSQL) where database administrators (DBAs) or compromised servers can secretly modify vote tallies without an audit trail.</p>
<p><strong>The Core Dilemma:</strong> While blockchain offers decentralized immutability and verifiable computation, standard blockchain voting requires voters to install browser extensions (MetaMask), hold private keys, and pay gas fees in volatile cryptocurrency (ETH/MATIC). This forms an impossible barrier for non-technical citizens. Furthermore, public blockchain transactions expose wallet addresses and choice parameters, violating ballot secrecy.</p>
<p><strong>BlockVote's Hybrid Breakthrough:</strong> BlockVote bridges this divide through an upgradeable Ethereum smart contract (<code>VotingV3</code>, UUPS proxy with 2-of-3 guardian multi-signature governance) that keys voters by salted Keccak-256 nullifiers and emits salted ballot commitments. The voter has zero blockchain overhead: a server-side gasless relayer with a serialized promise queue submits and sponsors all transactions. Voters authenticate via email OTP and AWS Rekognition face liveness, while the native Android app enforces a 240&deg; sensor-driven rotation scan. Coercion is mitigated via bounded re-voting (first vote + one change) and a final physical polling-station override.</p>

<h3>2. Section I: Introduction & The 6 Scientific Contributions</h3>
<p>The paper explicitly outlines six technical contributions distinguishing BlockVote from previous literature:</p>
<ol>
  <li><strong>Gasless Relayer with Serialized Nonce Queue:</strong> A platform-sponsored relay wallet executes <code>castVoteRelayedV3()</code>, eliminating voter cryptocurrency wallets and gas fees, while a promise queue and <code>NonceManager</code> eliminate EVM nonce collision during concurrent voting bursts.</li>
  <li><strong>Salted Keccak-256 Nullifier (Zero-PII On-Chain):</strong> Voters are identified on-chain exclusively via <code>keccak256(clean(email) || ":" || K_id)</code>, decoupling personal identifiable information (PII) from on-chain state while guaranteeing per-election uniqueness.</li>
  <li><strong>Sensor-Driven Biometric Liveness Workflow:</strong> Android motion sensing (240&deg; yaw tracking via <code>SensorManager</code>), ML Kit real-time face tracking (rejecting multi-face frames), and AWS Rekognition server-side validation (confidence &ge; 90%, open eyes, no glasses).</li>
  <li><strong>Blinded Ballots & Bounded Multi-Channel Re-Voting:</strong> On-chain events emit only salted hashes <code>keccak256(electionId || candidateId || nullifier || salt)</code>. Voters can cast 2 app votes (first vote + 1 change of mind); a physical polling-station vote is final and overrides remote ballots.</li>
  <li><strong>UUPS Upgradeability with 2-of-3 Multi-Signature Governance:</strong> Contract upgrades follow EIP-1822 Universal Upgradeable Proxy Standard requiring on-chain approvals from at least two out of three independent guardian cryptographic key holders.</li>
  <li><strong>Comprehensive Empirical Evaluation:</strong> 190 automated unit and security tests, gas consumption cross-validation between Hardhat local RPC and 114 live Ethereum Sepolia transactions, and Indian residential production latency profiling.</li>
</ol>

<h3>3. Section II: Literature Survey & Qualitative Comparison</h3>
<p>The paper surveys five generations of voting systems, highlighting trade-offs across 10 security and usability dimensions:</p>
<table>
  <thead>
    <tr>
      <th>Evaluation Property</th>
      <th>EVM + VVPAT</th>
      <th>Estonian i-Voting</th>
      <th>Helios</th>
      <th>Voatz</th>
      <th>Open Vote Network</th>
      <th>BlockVote (This Work)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Remote Voting</strong></td>
      <td>No (Physical Booth)</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Yes</td>
      <td><strong>Yes (Android App)</strong></td>
    </tr>
    <tr>
      <td><strong>Supervised In-Person Channel</strong></td>
      <td>Yes</td>
      <td>Yes</td>
      <td>No</td>
      <td>No</td>
      <td>No</td>
      <td><strong>Yes (/station kiosk)</strong></td>
    </tr>
    <tr>
      <td><strong>Re-Voting / Physical Override</strong></td>
      <td>No</td>
      <td>Yes (Estonian model)</td>
      <td>Partial</td>
      <td>No</td>
      <td>No</td>
      <td><strong>Yes (Bounded + Override)</strong></td>
    </tr>
    <tr>
      <td><strong>Public Tamper-Evident Ledger</strong></td>
      <td>No</td>
      <td>No</td>
      <td>Yes (Bulletin Board)</td>
      <td>Partial (Permissioned)</td>
      <td>Yes (Ethereum)</td>
      <td><strong>Yes (Ethereum Sepolia)</strong></td>
    </tr>
    <tr>
      <td><strong>Universally Verifiable Tally</strong></td>
      <td>Partial (Paper VVPAT)</td>
      <td>No</td>
      <td>Yes (Homomorphic)</td>
      <td>No</td>
      <td>Yes (Self-Tallying)</td>
      <td><strong>Yes (On-Chain Counters)</strong></td>
    </tr>
    <tr>
      <td><strong>Ballot Secrecy vs. Public</strong></td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Partial</td>
      <td>Yes</td>
      <td><strong>Yes (Salted Hash)</strong></td>
    </tr>
    <tr>
      <td><strong>Ballot Secrecy vs. Operator</strong></td>
      <td>Yes</td>
      <td>Partial (Key Holders)</td>
      <td>Partial (Trustees)</td>
      <td>No</td>
      <td>Yes</td>
      <td><strong>Relayer sees submission</strong></td>
    </tr>
    <tr>
      <td><strong>Automated Liveness / Biometrics</strong></td>
      <td>No (Manual ID)</td>
      <td>No</td>
      <td>No</td>
      <td>Yes (Face)</td>
      <td>No</td>
      <td><strong>Yes (Sensor + AWS)</strong></td>
    </tr>
    <tr>
      <td><strong>No Voter Wallet or Gas Fees</strong></td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>Yes</td>
      <td>No (Voter pays)</td>
      <td><strong>Yes (Gasless Relayer)</strong></td>
    </tr>
    <tr>
      <td><strong>Upgrade Governance</strong></td>
      <td>N/A</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>No (Immutable)</td>
      <td><strong>Yes (2-of-3 UUPS)</strong></td>
    </tr>
  </tbody>
</table>

<h3>4. Section III: Methodology & Mathematical Formulations</h3>
<p>BlockVote's operational mechanics are governed by formal mathematical specifications and algorithms:</p>

<h4>A. Nullifier Derivation (Equation 1)</h4>
<p>To record registration and prevent double voting without writing email addresses to the blockchain:</p>
<pre><code>n = Keccak256( clean(email) || ":" || K_id )</code></pre>
<p>Where <code>clean(email)</code> represents lowercase trimmed ASCII string, and <code>K_id</code> is a high-entropy 256-bit server secret (<code>SERVER_IDENTITY_SECRET</code>) protected by fail-closed environment checks. The contract stores <code>isRegisteredVoter[e][n]</code> and <code>voteChoice[n][e]</code>.</p>

<h4>B. Blinded Ballot Event (Equation 2)</h4>
<p>In legacy VotingV1, the contract emitted <code>VoteCast(electionId, candidateId)</code> which leaked candidate popularity and timing. VotingV3 emits:</p>
<pre><code>VoteCastPrivate( electionId, Keccak256(electionId || candidateId || n || s), isRevote )</code></pre>
<p>Where <code>s</code> is a cryptographically secure 32-byte pseudo-random salt generated by the backend relayer. Because <code>s</code> is 256 bits, dictionary pre-computation attacks by public node observers are mathematically impossible.</p>

<h4>C. UUPS 2-of-3 Multi-Signature Upgrade Rule (Equation 3)</h4>
<p>The contract authorization gate <code>_authorizeUpgrade(address newImplementation)</code> enforces:</p>
<pre><code>UpgradeAccepted = (approvalCount >= 2) AND (executed == false)</code></pre>
<p>Only three registered guardian hardware/wallet addresses can call <code>proposeUpgrade()</code> and <code>approveUpgrade()</code>. A single compromised key cannot alter election logic.</p>

<h4>D. Atomic Vote-Slot Reservation (Algorithm 1)</h4>
<p>To prevent race conditions where a voter attempts concurrent voting requests across multiple tabs or phones to bypass the 2-vote limit:</p>
<pre><code>1: Filter F = { _id: voterId, stationVoteFinal: { $ne: true } }
2: If channel == 'app': F = F AND (votesCast &lt; 2)
3: Update U = { $inc: { votesCast: 1 } }
4: If channel == 'station': U = U UNION { stationVoteFinal: true }
5: b = FindOneAndUpdate(F, U, return before)
6: If b == null: REJECT (VOTE_LIMIT_REACHED or STATION_VOTE_FINAL)
7: r = RelayCastVote(...)
8: If r fails: RESTORE voter document to state b (Slot rollback)</code></pre>

<h4>E. Codebase Size Metrics (Table II in Paper)</h4>
<table>
  <thead>
    <tr><th>Component</th><th>Files</th><th>Lines of Code (LOC)</th></tr>
  </thead>
  <tbody>
    <tr><td>Solidity Smart Contracts (V1, V2, V3)</td><td>3</td><td>959</td></tr>
    <tr><td>API Route Handlers (Next.js 15)</td><td>56</td><td>4,735</td></tr>
    <tr><td>Web Pages and Components (JSX / React 19)</td><td>44</td><td>7,699</td></tr>
    <tr><td>Server Libraries & Helpers (JS)</td><td>37</td><td>2,865</td></tr>
    <tr><td>Android Native App (Kotlin 2.2 / Compose)</td><td>42</td><td>5,351</td></tr>
    <tr><td><strong>Total Codebase</strong></td><td><strong>182</strong></td><td><strong>21,609</strong></td></tr>
  </tbody>
</table>

<h3>5. Section IV: Experimental Results, Gas Benchmarks & Production Data</h3>

<h4>A. Automated Testing Verification (190 Passing Tests)</h4>
<ul>
  <li><strong>VotingV3 Smart Contract Suite:</strong> 75 tests (Contract deployment, lifecycle, candidate tally decrement/increment, underflow guards, UUPS proxy upgrade authorization).</li>
  <li><strong>Adversarial Security Suite (A1 to A8):</strong> 30 tests covering malicious actors:
    <ul>
      <li><em>A1 Voter:</em> Unregistered vote rejected, zero nullifier rejected, direct non-relay call rejected, candidate ID out-of-range rejected.</li>
      <li><em>A2 Coercer:</em> Verifies candidate ID is absent from logs, legacy events disabled, coerced vote overwritten upon re-vote.</li>
      <li><em>A3 Admin:</em> Cannot add candidate once voting starts, cannot reopen completed election, single-guardian upgrade rejected.</li>
      <li><em>A4 Backend / DB Compromise:</em> Nullifier pre-image resistance verified.</li>
      <li><em>A5 Contract Integrity:</em> Vote conservation invariant verified (total candidates' votes == total registered ballots cast).</li>
      <li><em>A6 Relay Compromise:</em> Revoked relay privileges tested.</li>
      <li><em>A8 Guardian Collusion:</em> 2-of-3 quorum succeeds; 1 guardian alone fails.</li>
    </ul>
  </li>
  <li><strong>Production Readiness Suite:</strong> 26 tests (Fail-closed environment check, API key timing invariance, guardian EIP-712/191 signature validation with 5-minute TTL).</li>
  <li><strong>Preflight & Identity Suite:</strong> 22 tests (Eligibility caching, nullifier consistency).</li>
  <li><strong>Vote Rules Suite:</strong> 17 tests (Time window enforcement 07:00-18:00 IST, app 2-vote allowance, station override).</li>
  <li><strong>Rate Limiting & Biometric Suite:</strong> 20 tests (Sliding window limiter, JWT issue and signature tamper rejection).</li>
</ul>

<h4>B. Gas Consumption Benchmarks (Table III in Paper)</h4>
<table>
  <thead>
    <tr>
      <th>Contract Operation</th>
      <th>V3 Hardhat Benchmark (mean)</th>
      <th>V3 Sepolia Live Transactions (mean)</th>
      <th>V1 Baseline Contract</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Create Election</strong></td><td>238,635 gas (n=1)</td><td>223,253 gas (n=9)</td><td>238,613 gas</td></tr>
    <tr><td><strong>Add Candidate</strong></td><td>181,073 gas (n=3)</td><td>193,002 gas (n=17)</td><td>181,148 gas</td></tr>
    <tr><td><strong>Register Voter</strong></td><td>55,697 gas (n=50)</td><td>55,697 gas (n=83)</td><td>55,752 gas</td></tr>
    <tr><td><strong>Phase Transition</strong></td><td>38,619 gas (n=1)</td><td>38,619 gas (n=5)</td><td>38,585 gas</td></tr>
    <tr><td><strong>First Vote (Cast)</strong></td><td>89,946 gas (n=50)</td><td>&mdash;</td><td>66,784 gas</td></tr>
    <tr><td><strong>Re-Vote (Changed Candidate)</strong></td><td>77,478 gas (n=25)</td><td>&mdash;</td><td>N/A (V1 unsupported)</td></tr>
    <tr><td><strong>Re-Vote (Same Candidate)</strong></td><td>63,974 gas (n=25)</td><td>&mdash;</td><td>N/A (V1 unsupported)</td></tr>
  </tbody>
</table>
<div class="callout">
  <div class="callout-title">Key Benchmark Findings:</div>
  <p>1. Voter registration gas matches Sepolia <em>exactly</em> at <strong>55,697 gas</strong> across both Hardhat and 83 live Sepolia transactions.<br>
  2. First ballot in V3 costs <strong>89,946 gas</strong>. Compared to V1 (66,784 gas), the addition of ballot salt hashing and <code>voteChoice</code> storage write adds 23,162 gas (+34.7%).<br>
  3. Re-voting for a changed candidate costs <strong>77,478 gas</strong> (lower than first vote because storage slot <code>voteChoice</code> is already non-zero, requiring 2,900 gas instead of 20,000 gas SSTORE).<br>
  4. Total gas sponsored per single-vote voter = 55,697 + 89,946 = <strong>145,643 gas</strong>.</p>
</div>

<h4>C. Real-World Financial Cost & Throughput Analysis</h4>
<ul>
  <li><strong>Gas Price:</strong> Observed Sepolia median gas price = <strong>1.09 gwei</strong>.</li>
  <li><strong>Cost Per Voter:</strong> At 1.09 gwei, 145,643 gas costs $1.59 \\times 10^{-4}$ ETH (approx. &dollar;0.40 USD at &dollar;2,500/ETH).</li>
  <li><strong>Cumulative Production Cost:</strong> 114 real Sepolia transactions logged between 12&ndash;21 August 2026 consumed exactly <strong>0.01224 ETH</strong>.</li>
  <li><strong>Throughput:</strong> Single-queue serialized relayer processes 1 confirmed transaction per Ethereum block (~12 s slot time) &cong; <strong>300 votes/hour</strong> per relayer instance. Pipelining or deploying on Layer-2 (Arbitrum/Optimism) scales this to 3,000+ votes/hour at &lt;&dollar;0.01/vote.</li>
</ul>

<h4>D. Production Latency Distribution</h4>
<ul>
  <li><strong>Lightweight API Endpoints (Health, Auth):</strong> p50 = 230&ndash;260 ms.</li>
  <li><strong>Heavy Endpoints (MongoDB + RPC Reads):</strong> p50 = 657&ndash;797 ms.</li>
  <li><strong>Cold-Start p95 Outliers:</strong> 1.7 s to 5.0 s (characteristic of Vercel serverless cold starts).</li>
  <li><strong>Sepolia Transaction Inclusion Time:</strong> 12.4 s mean (consistent with Ethereum's 12-second block intervals).</li>
  <li><strong>Concurrent Burst Test:</strong> 50 simultaneous ballot submissions achieved 100% completion with zero nonce collisions.</li>
</ul>

<h3>6. Section V: Honest Limitations Disclosed in the Paper</h3>
<p>The paper explicitly acknowledges real-world limitations for academic integrity:</p>
<ol>
  <li><strong>Relay Operator Trust:</strong> While the public cannot see candidate choices from blockchain events, the Next.js BFF server and the relay wallet briefly see the candidate ID in HTTP payloads prior to hashing.</li>
  <li><strong>Liveness vs. Enrollment Matching:</strong> The face gate checks <em>liveness</em> (is there a live, conscious human?) but does not perform 1-to-1 biometric face matching against an enrolled government ID photo.</li>
  <li><strong>Server Secret Dependency:</strong> If <code>SERVER_IDENTITY_SECRET</code> were leaked alongside the voter email list, an adversary could recompute all nullifiers and read choices from on-chain storage.</li>
</ol>
""")

        # SECTION 2: PART 1 - PROJECT OVERVIEW
        f.write("""
<div class="page-break"></div>
<h2>PART 1 — PROJECT OVERVIEW</h2>

<h3>1. Project Name</h3>
<p><strong>BlockVote</strong> (Official Academic Title: <em>BlockVote: A Gasless, Coercion-Mitigating Decentralized E-Voting System Combining Sensor-Driven Biometric Liveness, UUPS Multi-Signature Governance, and On-Chain Keccak-256 Nullifiers</em>).</p>

<h3>2. Problem Statement</h3>
<p>Traditional voting systems face severe vulnerabilities:</p>
<ul>
  <li><strong>Paper Ballots:</strong> High administrative costs, vulnerability to physical tampering, slow and error-prone manual counting.</li>
  <li><strong>Electronic Voting Machines (EVMs):</strong> Require physical presence at booths, lack remote accessibility, and rely on proprietary hardware that invites political skepticism.</li>
  <li><strong>Centralized Online Voting:</strong> Stores votes in centralized databases (e.g. MySQL, MongoDB) where a single rogue database administrator (DBA) or cloud breach can alter tallies undetected.</li>
  <li><strong>Standard Blockchain Voting (Web3):</strong> Requires every voter to create a MetaMask wallet, safeguard a 12-word seed phrase, and purchase volatile cryptocurrency to pay gas fees. Additionally, public ledger transactions compromise voter privacy.</li>
</ul>

<h3>3. Proposed Solution</h3>
<p>BlockVote introduces a hybrid decentralized architecture that eliminates all voter-facing blockchain complexity:</p>
<ul>
  <li>Voters cast ballots through an intuitive Android mobile app or a supervised polling station kiosk without needing a wallet, private key, or cryptocurrency.</li>
  <li>A centralized Next.js backend with an autonomous <strong>Gas Station Relayer</strong> sponsors all transaction fees and submits votes directly to an upgradeable Ethereum smart contract.</li>
  <li>Voter identity is permanently masked using a cryptographically salted <strong>Keccak-256 nullifier</strong>.</li>
  <li>Ballot privacy is secured by emitting blinded cryptographic hashes rather than plaintext candidate choices.</li>
  <li>Coercion is mitigated through <strong>bounded re-voting</strong> (allowing one change of mind) and a <strong>polling station override</strong> where an in-person supervised vote irrevocably supersedes all previous remote votes.</li>
</ul>

<h3>4. Main Objective</h3>
<p>To design, implement, and benchmark an accessible, end-to-end verifiable, and coercion-mitigating electronic voting platform suitable for institutional elections (such as university student councils, professional societies, and corporate shareholder boards) that combines blockchain transparency with gasless user simplicity.</p>

<h3>5. Target Users</h3>
<ul>
  <li><strong>Eligible Voters:</strong> Students, faculty, or organization members who cast votes remotely via the Android app or in-person via the polling station web kiosk.</li>
  <li><strong>Election Administrators:</strong> Authorized election officials who create elections, upload candidate profiles, import voter rosters (via CSV), set voting schedules, and monitor live participation.</li>
  <li><strong>Election Guardians:</strong> Independent trustees who hold cryptographic keys to approve election go-live and jointly authorize smart contract upgrades via a 2-of-3 multi-signature threshold.</li>
  <li><strong>Public / Independent Auditors:</strong> External observers who verify the mathematical integrity of the election via public blockchain transaction receipts and audit APIs without compromising ballot secrecy.</li>
</ul>

<h3>6. Real-World Use Cases</h3>
<ul>
  <li><strong>University & College Elections:</strong> Student council elections, faculty senate representations, and department chair selections (directly suited for Pillai HOC College and similar institutions).</li>
  <li><strong>Corporate Governance:</strong> Board of Directors elections and proxy shareholder voting where remote participation and tamper-proof audit trails are essential.</li>
  <li><strong>Cooperative Societies & NGOs:</strong> Housing society executive committees, non-profit governance, and trade union voting.</li>
  <li><strong>Professional Associations:</strong> IEEE student branches, Computer Society of India (CSI), and state bar associations.</li>
</ul>

<h3>7. Major Features</h3>
<ul>
  <li><strong>Gasless Relayed Voting:</strong> Backend relayer wallet pays all gas; voters never see MetaMask or transaction prompts.</li>
  <li><strong>Deterministic Keccak-256 Nullifiers:</strong> Masks email addresses into 32-byte hashes; zero personal identifiable information (PII) on the blockchain.</li>
  <li><strong>Sensor-Driven Biometric Liveness:</strong> Native Android camera and gyroscope tracking requiring a 240&deg; head rotation to defeat static photo or screen spoofing.</li>
  <li><strong>Cloud Face Quality Verification:</strong> AWS Rekognition validation checking face confidence &ge; 90%, open eyes, and absence of sunglasses.</li>
  <li><strong>Dual-Factor Authentication:</strong> Time-sensitive 6-digit OTP delivered via email (Resend API) hashed using bcrypt with sliding-window rate limiting.</li>
  <li><strong>Bounded Re-Voting (Anti-Coercion):</strong> Remote voters can vote once and change their vote exactly once; only the latest vote is counted on-chain.</li>
  <li><strong>Supervised Polling Station Override:</strong> Admin-activated kiosk vote via HMAC-authenticated session cookie; overrides any remote vote and locks the ballot permanently.</li>
  <li><strong>UUPS 2-of-3 Guardian Governance:</strong> Smart contract upgrades governed by multi-signature threshold; no single admin can alter contract logic.</li>
  <li><strong>EIP-191 Signed Admin Actions:</strong> Privileged dashboard actions require cryptographic wallet signatures with 5-minute time-to-live (TTL).</li>
  <li><strong>Independent Public Audit Route:</strong> <code>GET /api/audit/verify?txHash=...</code> allows anyone to verify blockchain inclusion without exposing the voter's choice.</li>
</ul>

<h3>8. Technology Stack</h3>
<table>
  <thead>
    <tr><th>Category</th><th>Technology</th><th>Version / Details</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Smart Contracts</strong></td><td>Solidity, OpenZeppelin UUPS</td><td>Solidity 0.8.22, OpenZeppelin Contracts Upgradeable v5.6</td></tr>
    <tr><td><strong>Blockchain / RPC</strong></td><td>Ethereum Sepolia Testnet, Hardhat</td><td>Hardhat 2.28 (local development/tests), Sepolia (live deployment)</td></tr>
    <tr><td><strong>Web Backend & BFF</strong></td><td>Next.js (App Router), Node.js</td><td>Next.js 15.3, React 19.1, Auth.js v5</td></tr>
    <tr><td><strong>Web3 Library</strong></td><td>ethers.js</td><td>ethers v6.15 (with NonceManager & JsonRpcProvider)</td></tr>
    <tr><td><strong>Mobile Frontend</strong></td><td>Native Android (Jetpack Compose)</td><td>Kotlin 2.2, Jetpack Compose, Hilt 2.57, CameraX 1.5, Coil</td></tr>
    <tr><td><strong>On-Device ML</strong></td><td>Google ML Kit Face Detection</td><td>ML Kit Face 16.1.7 (real-time 90ms frame evaluation)</td></tr>
    <tr><td><strong>Operational Database</strong></td><td>MongoDB Atlas</td><td>Mongoose ODM (Voter, Election, EmailOTP, RelayTransaction models)</td></tr>
    <tr><td><strong>Decentralized Storage</strong></td><td>Pinata IPFS</td><td>Immutable election snapshot and candidate roster pinning</td></tr>
    <tr><td><strong>Cloud Biometrics</strong></td><td>AWS Rekognition</td><td><code>DetectFacesCommand</code> (confidence, quality, open eyes)</td></tr>
    <tr><td><strong>Cloud Image Hosting</strong></td><td>ImageKit & AWS S3</td><td>Candidate photos and official political party symbols</td></tr>
    <tr><td><strong>Transactional Email</strong></td><td>Resend API</td><td>Email invitation links, 6-digit OTPs, and vote receipts</td></tr>
    <tr><td><strong>Production Hosting</strong></td><td>Vercel</td><td>Serverless edge deployment for Next.js BFF</td></tr>
  </tbody>
</table>

<h3>9. System Architecture</h3>
<p>BlockVote operates on a five-tier decoupled architecture designed for separation of concerns:</p>
<pre><code>[ VOTER / CLIENT TIER ]
   ├── Android Mobile App (Compose + CameraX + ML Kit + SensorManager)
   └── Polling Station Kiosk (/station/vote via HMAC-SHA256 Cookie)
            │ (HTTPS / JSON)
            ▼
[ APPLICATION BFF TIER (Next.js 15 on Vercel) ]
   ├── Authentication & Rate Limiting (bcrypt OTP, sliding window)
   ├── Biometric Verification Gate (AWS Rekognition DetectFaces)
   ├── Off-Chain Vote Ledger & Atomic Slot Reservation (voteLedger.js)
   └── Guardian Authorization & Audit Engine (EIP-191 signatures)
            │
            ├──────► MongoDB Atlas (Admin state, OTPs, Voter roster, Gas logs)
            ├──────► Resend (Transactional OTP & receipt delivery)
            ├──────► Pinata IPFS (Decentralized metadata archiving)
            │
            ▼
[ GASLESS RELAY ENGINE (lib/relay.js) ]
   ├── Serialized Promise Queue (One in-flight transaction at a time)
   ├── Ethers NonceManager (Automatic nonce tracking & resync)
   └── Linear Backoff Retry Logic (Up to 4 retries on nonce collision)
            │ (JSON-RPC)
            ▼
[ BLOCKCHAIN TIER (Ethereum Sepolia / Hardhat) ]
   ├── ERC-1967 Proxy Contract (Holds election storage & balances)
   └── VotingV3 Implementation (UUPS upgradeable, nullifier mappings, 2-of-3 guardians)</code></pre>

<h3>10. Complete System Flow</h3>
<ol>
  <li><strong>Voter Invitation:</strong> Admin uploads voter CSV roster. Next.js creates <code>Voter</code> documents in MongoDB and emails deep links (<code>blockvote://vote/{electionId}</code>).</li>
  <li><strong>Voter Authentication:</strong> Voter enters their email. Backend verifies eligibility, generates a cryptographically random 6-digit OTP, stores its bcrypt hash, and dispatches it via Resend.</li>
  <li><strong>Sensor-Driven Biometric Liveness:</strong>
    <ul>
      <li>On Android: Voter opens the camera. <code>PhoneRotationTracker</code> tracks gyroscope yaw. The voter rotates their phone 240&deg; while ML Kit verifies only one human face is present.</li>
      <li>Once completed, the app captures a frame and sends it to <code>POST /api/biometric/verify</code>.</li>
      <li>The server invokes AWS Rekognition. Upon satisfying confidence &ge; 90%, open eyes, and no glasses, the server issues a 10-minute HS256 biometric JWT token bound to the voter's nullifier.</li>
    </ul>
  </li>
  <li><strong>Ballot Selection & OTP Submission:</strong> Voter reviews candidates and selects their choice. The app submits <code>POST /api/auth/verify-otp</code> containing email, OTP, <code>electionId</code>, <code>candidateId</code>, and <code>x-biometric-token</code>.</li>
  <li><strong>Atomic Ledger Check:</strong> Server validates OTP and biometric JWT. <code>reserveVoteSlot()</code> executes an atomic MongoDB <code>findOneAndUpdate</code> ensuring votesCast &lt; 2 (or setting <code>stationVoteFinal: true</code> if at a station).</li>
  <li><strong>Gasless Relaying to Smart Contract:</strong>
    <ul>
      <li>Relayer generates a fresh 32-byte <code>ballotSalt</code>.</li>
      <li>The transaction enters the serialized queue. <code>relayWallet</code> signs and broadcasts <code>castVoteRelayedV3(electionId, candidateId, nullifier, ballotSalt)</code>.</li>
      <li>Smart contract checks registration, validates Voting phase, decrements previous candidate count (if re-vote), increments new candidate count, updates <code>voteChoice</code>, and emits <code>VoteCastPrivate</code>.</li>
    </ul>
  </li>
  <li><strong>Confirmation & Audit:</strong> The transaction receipt is returned. The voter receives an email receipt containing the Ethereum transaction hash (without revealing candidate choice). The public can audit the transaction via <code>GET /api/audit/verify?txHash=...</code>.</li>
</ol>

<h3>11. Blockchain Role</h3>
<ul>
  <li><strong>Why Blockchain?</strong> To eliminate the centralized database as a single point of failure and manipulation. Once a vote is included in an Ethereum block, it cannot be altered by administrators, database engineers, or external attackers.</li>
  <li><strong>What is Stored On-Chain:</strong>
    <ul>
      <li>Election metadata (title, start/end timestamps, phase).</li>
      <li>Candidate names, party names, manifesto strings, and vote count totals.</li>
      <li>Registration mapping: <code>isRegisteredVoter[electionId][nullifier]</code>.</li>
      <li>Current choice storage: <code>voteChoice[nullifier][electionId] = candidateId + 1</code>.</li>
      <li>Voter revision counter: <code>voteRevisionCount[nullifier][electionId]</code>.</li>
      <li>Guardian addresses and UUPS upgrade proposals.</li>
    </ul>
  </li>
  <li><strong>What is NOT Stored On-Chain:</strong> Voter names, email addresses, phone numbers, biometric facial images, IP addresses, and plaintext vote choice event logs.</li>
  <li><strong>Gasless Handling:</strong> The voter pays zero gas. The platform relayer wallet pays all gas using Sepolia test ETH, tracked via MongoDB <code>RelayTransaction</code> logs.</li>
</ul>

<h3>12. Privacy & Security</h3>
<ul>
  <li><strong>Nullifier Masking:</strong> <code>keccak256(email || ":" || SERVER_IDENTITY_SECRET)</code> guarantees deterministic uniqueness without exposing emails.</li>
  <li><strong>Blinded Ballot Commitments:</strong> On-chain event emits <code>keccak256(electionId || candidateId || nullifier || salt)</code> with a random 256-bit salt, preventing dictionary eavesdropping.</li>
  <li><strong>Coercion Mitigation:</strong> Bounded re-voting allows a coerced voter to overwrite their vote later; the physical polling station provides a decisive override.</li>
  <li><strong>Biometric Quality Gate:</strong> AWS Rekognition enforces liveness attributes, and the Android sensor tracker prevents static photo replays.</li>
</ul>

<h3>13. My Personal Contribution (Deven Wagh - Lead Developer)</h3>
<p>As the first author of the research paper and primary system architect, my contributions encompass:</p>
<ul>
  <li><strong>Smart Contract Core (<code>Voting/contracts/VotingV3.sol</code>):</strong> Designed the UUPS upgradeable contract, implemented <code>castVoteRelayedV3()</code> with vote revision logic, underflow protection, and 2-of-3 guardian multi-sig gates.</li>
  <li><strong>Gasless Relayer Engine (<code>Voting/lib/relay.js</code>):</strong> Implemented the serialized promise queue, ethers.js <code>NonceManager</code> integration, gas logging to MongoDB, and automated nonce-collision retry logic.</li>
  <li><strong>Voter Identity & Anti-Double-Vote Ledger (<code>Voting/lib/voterIdentity.js</code>, <code>voteAllowance.js</code>, <code>voteLedger.js</code>):</strong> Developed deterministic nullifier derivation, atomic MongoDB reservation algorithms, and bounded multi-channel vote policies.</li>
  <li><strong>Authentication & Verification Pipeline (<code>Voting/app/api/auth/verify-otp/route.js</code>, <code>Voting/lib/biometric.js</code>):</strong> Built the OTP verification route, AWS Rekognition biometric validation, and short-lived HS256 biometric JWT token generation.</li>
  <li><strong>Empirical Gas & Security Benchmarking (<code>Voting/scripts/benchmark-gas.js</code>, <code>docs/paper/</code>):</strong> Authored the automated Hardhat gas benchmark suite, analyzed 114 live Sepolia transactions, and authored the IEEE research paper.</li>
</ul>
""")

        # SECTION 3: PART 2 - ALL 28 VIVA QUESTIONS AND ANSWERS
        f.write("""
<div class="page-break"></div>

<div class="page-break"></div>
<h2>TEAM WORK DIVISION: WHO IMPLEMENTED WHAT (3 TEAM MEMBERS)</h2>
<p>To defend your MCA project convincingly as a team, each member must have a clearly defined, non-overlapping, and technically defensible role. Below is the official division based on the actual 21,609-line codebase and the published IEEE research paper.</p>

<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-val">Deven Wagh</div>
    <div class="stat-lbl">Blockchain & Relayer Lead (~5,200 LOC)</div>
  </div>
  <div class="stat-card">
    <div class="stat-val">Kalpit Mhatre</div>
    <div class="stat-lbl">Web & Governance Lead (~9,800 LOC)</div>
  </div>
  <div class="stat-card">
    <div class="stat-val">Rohit Zagade</div>
    <div class="stat-lbl">Android & Biometrics Lead (~6,100 LOC)</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Dimension</th>
      <th>Member 1: Deven Wagh (Lead Author)</th>
      <th>Member 2: Kalpit Mhatre (Co-Author)</th>
      <th>Member 3: Rohit Zagade (Co-Author)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Core Role & Title</strong></td>
      <td><strong>System Architect & Blockchain / Security Lead</strong></td>
      <td><strong>Full-Stack Web, Governance & Cloud Lead</strong></td>
      <td><strong>Mobile Android & Biometrics Lead</strong></td>
    </tr>
    <tr>
      <td><strong>Primary Modules</strong></td>
      <td>Solidity Smart Contracts, Gasless Relayer Engine, Nullifier Privacy, Atomic Vote Ledger, Gas Benchmarks</td>
      <td>Admin Web Dashboard, Guardian Multi-Sig Portal, Polling Station Kiosk, MongoDB, IPFS, Email Engine</td>
      <td>Android Native Compose App, CameraX Liveness, Gyroscope Rotation Sensor Tracker, AWS Rekognition Gate</td>
    </tr>
    <tr>
      <td><strong>Lines of Code (LOC)</strong></td>
      <td><strong>~5,200 LOC</strong><br>(959 Solidity + 1,100 JS Relayer/Ledger + 1,200 API/Auth + 2,000 Tests/Benchmarks)</td>
      <td><strong>~9,800 LOC</strong><br>(4,800 Admin JSX + 1,900 Guardian/Station + 1,800 Cloud/DB + 1,300 API Routes)</td>
      <td><strong>~6,100 LOC</strong><br>(5,351 Kotlin Compose/Sensors + 750 AWS Biometrics API)</td>
    </tr>
    <tr>
      <td><strong>Key Files Owned</strong></td>
      <td>
        <code>Voting/contracts/VotingV3.sol</code><br>
        <code>Voting/lib/relay.js</code><br>
        <code>Voting/lib/voterIdentity.js</code><br>
        <code>Voting/lib/voteLedger.js</code><br>
        <code>Voting/lib/voteAllowance.js</code><br>
        <code>Voting/scripts/benchmark-gas.js</code>
      </td>
      <td>
        <code>Voting/app/dashboard/*</code><br>
        <code>Voting/app/admin/*</code><br>
        <code>Voting/app/station/*</code><br>
        <code>Voting/lib/models/*</code><br>
        <code>Voting/lib/ipfs.js</code><br>
        <code>Voting/lib/mailer.js</code><br>
        <code>Voting/lib/stationSession.js</code>
      </td>
      <td>
        <code>app/.../VotePortalScreen.kt</code><br>
        <code>app/.../FaceCaptureCamera.kt</code><br>
        <code>app/.../PhoneRotationTracker.kt</code><br>
        <code>app/.../DashboardScreen.kt</code><br>
        <code>Voting/lib/biometric.js</code><br>
        <code>Voting/app/api/biometric/verify/route.js</code>
      </td>
    </tr>
    <tr>
      <td><strong>Key Functions / Methods</strong></td>
      <td>
        <code>castVoteRelayedV3()</code><br>
        <code>_authorizeUpgrade()</code><br>
        <code>sendRelayTx()</code><br>
        <code>enqueueRelay()</code><br>
        <code>computeNullifierHash()</code><br>
        <code>reserveVoteSlot()</code>
      </td>
      <td>
        <code>createElection()</code><br>
        <code>parseVoterCSV()</code><br>
        <code>approveGoLive()</code><br>
        <code>verifyGuardianSig()</code><br>
        <code>getStationSession()</code><br>
        <code>pinJSONToIPFS()</code>
      </td>
      <td>
        <code>onSensorChanged()</code><br>
        <code>processImageProxy()</code><br>
        <code>detectFaces()</code><br>
        <code>issueBiometricToken()</code><br>
        <code>submitBallot()</code>
      </td>
    </tr>
    <tr>
      <td><strong>If Sir Asks "Show Me Code"</strong></td>
      <td>Open <code>VotingV3.sol</code> and <code>relay.js</code></td>
      <td>Open <code>dashboard/page.jsx</code> and <code>stationSession.js</code></td>
      <td>Open <code>PhoneRotationTracker.kt</code> and <code>FaceCaptureCamera.kt</code></td>
    </tr>
  </tbody>
</table>

<hr>

<h3>MEMBER 1: DEVEN WAGH (Lead Architect — Blockchain, Relayer & Security Core)</h3>
<p><strong>Personal Speech to Sir:</strong> <em>"Sir, I was responsible for the core decentralized architecture, the smart contracts, the gasless relayer system, and the cryptographic privacy mechanisms."</em></p>
<h4>Detailed Responsibilities:</h4>
<ul>
  <li><strong>Smart Contract Architecture (<code>VotingV3.sol</code>):</strong> Designed the UUPS upgradeable contract, wrote <code>castVoteRelayedV3()</code> with the bounded re-vote logic (decrementing old candidate and incrementing new candidate in a single atomic transaction), implemented the underflow guard, and enforced the 2-of-3 guardian multi-signature upgrade gate in <code>_authorizeUpgrade()</code>.</li>
  <li><strong>Gasless Relayer Engine (<code>Voting/lib/relay.js</code>):</strong> Built the serialized promise queue (<code>enqueueRelay</code>) and integrated <code>ethers.NonceManager</code> with a 4-attempt linear backoff retry loop to completely eliminate Ethereum nonce collisions during burst traffic.</li>
  <li><strong>Voter Identity & Anti-Double-Vote Ledger (<code>Voting/lib/voterIdentity.js</code> & <code>voteLedger.js</code>):</strong> Implemented the salted Keccak-256 nullifier formula <code>keccak256(clean(email) || ":" || SERVER_IDENTITY_SECRET)</code> and the atomic MongoDB <code>reserveVoteSlot()</code> algorithm with automatic rollback on relay failure.</li>
  <li><strong>Gas Benchmarking & Security Testing:</strong> Wrote the Hardhat gas benchmark suite (<code>scripts/benchmark-gas.js</code>) and the 30 adversarial security test scenarios (A1–A8).</li>
</ul>
<h4>3 Questions Sir Will Ask Deven:</h4>
<ol>
  <li><em>"How does re-voting decrement the candidate count on-chain?"</em> &rarr; <code>voteChoice</code> maps nullifier to <code>oldCandidateId + 1</code>. If exists, decrement <code>candidates[oldId].voteCount</code> and increment <code>candidates[newId].voteCount</code>.</li>
  <li><em>"How do you prevent nonce errors when 50 voters submit at once?"</em> &rarr; <code>ethers.NonceManager</code> + serialized promise queue (<code>enqueueRelay</code>) in <code>relay.js</code>.</li>
  <li><em>"Can someone reverse the nullifier to get the email?"</em> &rarr; No, Keccak-256 is one-way, and the 256-bit <code>SERVER_IDENTITY_SECRET</code> prevents rainbow table attacks.</li>
</ol>

<hr>

<h3>MEMBER 2: KALPIT MHATRE (Full-Stack Web, Governance & Cloud Lead)</h3>
<p><strong>Personal Speech to Sir:</strong> <em>"Sir, I was responsible for the administrative web platform, guardian multi-signature governance, the supervised polling-station kiosk, and cloud database/storage integrations."</em></p>
<h4>Detailed Responsibilities:</h4>
<ul>
  <li><strong>Admin Web Dashboard (<code>Voting/app/dashboard/*</code>):</strong> Built the election management interfaces using Next.js 15, React 19, and Fluent UI v9. Implemented CSV voter roster ingestion, candidate profile creation, candidate photo uploads, and live turnout analytics.</li>
  <li><strong>Guardian Multi-Sig & Governance Portal (<code>Voting/app/admin/*</code>):</strong> Developed the threshold approval dashboard where guardians connect their Ethereum wallets to review and approve election go-live and contract upgrades using EIP-191 cryptographic signatures with 5-minute TTL.</li>
  <li><strong>Supervised Polling Station Kiosk (<code>Voting/app/station/*</code>):</strong> Implemented the kiosk activation flow where an admin activates a booth computer, setting an <code>httpOnly</code>, <code>SameSite=Strict</code> session cookie authenticated with HMAC-SHA256 (16-hour validity). Built the in-person ballot UI that overrides remote app votes.</li>
  <li><strong>Cloud & Database Architecture:</strong> Designed the Mongoose schemas (<code>Voter</code>, <code>Election</code>, <code>EmailOTP</code>, <code>RelayTransaction</code>, <code>VoteActivity</code>), integrated Pinata IPFS for archiving election snapshots, and set up Resend email templates for voter invites and OTPs.</li>
</ul>
<h4>3 Questions Sir Will Ask Kalpit:</h4>
<ol>
  <li><em>"How does the polling station computer know it is authorized?"</em> &rarr; Admin logs in at <code>/station</code>, which signs a 16-hour HMAC-SHA256 <code>bv_station</code> cookie containing station ID and election ID. The ballot at <code>/station/vote</code> only renders if this cookie verifies.</li>
  <li><em>"How do guardians sign dashboard actions without paying gas?"</em> &rarr; They sign an off-chain EIP-191 message using their private key in MetaMask; our backend recovers the signer address using <code>ethers.verifyMessage()</code> and checks it against on-chain guardian addresses.</li>
  <li><em>"Why do you store data in MongoDB if you have IPFS?"</em> &rarr; MongoDB handles fast, mutable operational queries (session tracking, OTPs, rate limits), while IPFS stores static, immutable snapshots of election metadata and final rosters.</li>
</ol>

<hr>

<h3>MEMBER 3: ROHIT ZAGADE (Mobile Android & Biometrics Lead)</h3>
<p><strong>Personal Speech to Sir:</strong> <em>"Sir, I was responsible for the native Android voter application, real-time camera face tracking with ML Kit, hardware sensor motion liveness, and AWS Rekognition integration."</em></p>
<h4>Detailed Responsibilities:</h4>
<ul>
  <li><strong>Native Android Application (<code>app/src/main/java/*</code>):</strong> Architected the Android application using Kotlin 2.2, Jetpack Compose, Hilt dependency injection, and MVVM architecture. Built <code>VotePortalScreen.kt</code>, <code>DashboardScreen.kt</code>, <code>ElectionDetailScreen.kt</code>, and <code>ReceiptScreen.kt</code>.</li>
  <li><strong>Hardware Sensor Motion Tracking (<code>PhoneRotationTracker.kt</code>):</strong> Developed the custom sensor listener using Android <code>SensorManager</code> and <code>Sensor.TYPE_ROTATION_VECTOR</code> to calculate yaw orientation matrices, requiring voters to rotate 240&deg; continuously to prove dynamic physical presence.</li>
  <li><strong>Real-Time Camera & ML Kit Face Isolation (<code>FaceCaptureCamera.kt</code>):</strong> Integrated CameraX front-camera stream analyzed every 90 ms by Google ML Kit Face Detection. Implemented bounding oval validation (face must occupy 10&ndash;38% of frame height) and auto-resetting when multiple faces appear.</li>
  <li><strong>Cloud Biometric Verification API (<code>Voting/lib/biometric.js</code> & <code>api/biometric/verify/route.js</code>):</strong> Built the server-side biometric verification route calling AWS Rekognition <code>DetectFacesCommand</code>, checking face confidence &ge; 90%, open eyes, and no glasses, and issuing short-lived HS256 biometric JWTs.</li>
  <li><strong>Deep Linking & Networking:</strong> Configured <code>blockvote://vote/{electionId}</code> deep links and verified HTTPS App Links, Retrofit/OkHttp network layer, and Coil image loading for party symbols.</li>
</ul>
<h4>3 Questions Sir Will Ask Rohit:</h4>
<ol>
  <li><em>"How does your sensor tracker know the phone actually rotated?"</em> &rarr; <code>PhoneRotationTracker</code> listens to <code>Sensor.TYPE_ROTATION_VECTOR</code>, converts quaternions to rotation matrices via <code>SensorManager.getRotationMatrixFromVector()</code>, extracts yaw in radians, and accumulates absolute degree changes until reaching 240&deg;.</li>
  <li><em>"What happens if a friend stands behind the voter during the scan?"</em> &rarr; Google ML Kit detects <code>faces.size > 1</code>, which instantly pauses the scan, resets accumulated rotation to 0, and displays a warning prompt: 'Multiple faces detected'.</li>
  <li><em>"Why don't you store voter face photos on the server?"</em> &rarr; For strict privacy compliance: the captured frame is passed in memory to AWS Rekognition for liveness attribute validation and immediately discarded. No facial template is stored.</li>
</ol>

<h2>PART 2 — VIVA QUESTIONS AND ANSWERS (ALL 28 QUESTIONS)</h2>
<p>Each question is answered in a four-part format tailored for your MCA project examination.</p>
""")

        # Questions List with Data
        qa_data = [
            (
                "Q1. Where can BlockVote be used?",
                "BlockVote is designed for institutional and organizational elections—such as university student council elections, corporate shareholder voting, cooperative housing societies, and professional organizations like IEEE student branches.",
                "In our implementation, voter rosters are managed per-election via CSV upload, voters are authenticated via institutional email OTP and facial liveness, and the backend relayer sponsors blockchain gas. This makes it ideal for closed-membership organizations where gas fees would otherwise prevent voter participation.",
                "Because national general elections require universal physical biometric voter ID enrollment (like Aadhaar/EVM-VVPAT) and legal statutory frameworks, whereas BlockVote's email roster and gasless relayer model perfectly match university and organizational governance.",
                "Voting/app/dashboard/elections/page.jsx (Admin election management) and Voting/lib/models/Voter.js (Roster schema)."
            ),
            (
                "Q2. What problem does your project solve?",
                "BlockVote solves three major problems: first, the vulnerability of traditional web voting to silent database manipulation; second, the high barrier of cryptocurrency wallets and gas fees in standard Web3 voting; and third, voter coercion in remote voting.",
                "Centralized databases like MySQL or MongoDB allow admins with root access to silently update vote totals. Standard blockchain voting solves tampering but requires users to hold crypto wallets (MetaMask) and pay gas. BlockVote uses smart contracts for immutable counting, a gasless relayer so voters need zero crypto, and bounded re-voting plus a polling station override to defeat voter coercion.",
                "Because simply putting a voting system on blockchain isn't enough if ordinary students cannot use it due to MetaMask complexity, or if a family member or hostel senior forces someone to vote a certain way.",
                "Voting/contracts/VotingV3.sol (castVoteRelayedV3) and Voting/lib/relay.js (gasless relayer)."
            ),
            (
                "Q3. Why did you choose this project?",
                "I chose BlockVote because digital voting is one of the most challenging computer science problems—it requires balancing two contradictory goals: complete election transparency and verifiable counting on one hand, and strict voter privacy and coercion resistance on the other.",
                "Most existing blockchain projects simply publish votes directly on Ethereum, which violates privacy, or they require voters to purchase cryptocurrency. I wanted to build a practical, real-world system that merges modern Web2 usability (Next.js, Android Compose, email OTP) with Web3 decentralized integrity (Ethereum smart contracts, zero gas fees).",
                "Because college and organizational elections are frequently plagued by distrust in manual counting, yet students refuse to use complex decentralized apps. BlockVote bridges that exact gap.",
                "docs/paper/BlockVote_IEEE_merged.tex (Section I: Introduction and Motivation)."
            ),
            (
                "Q4. What is the main objective of BlockVote?",
                "The main objective is to provide a gasless, transparent, tamper-proof, and coercion-mitigating digital voting platform where votes are recorded on an Ethereum smart contract without requiring voters to own cryptocurrency or compromise their ballot privacy.",
                "The objective is realized through four pillars: (1) Smart contract immutability via VotingV3 on Sepolia; (2) Gas abstraction via a centralized relayer; (3) Identity protection via Keccak-256 nullifiers and salted ballot commitments; and (4) Coercion mitigation via bounded re-voting and physical kiosk overrides.",
                "Because if the voter had to pay gas or manage private keys, voter turnout would collapse; if the ballot weren't on a decentralized ledger, election results could be altered by server administrators.",
                "Voting/contracts/VotingV3.sol (Lines 47-511) and Voting/lib/voteAllowance.js."
            ),
            (
                "Q5. What are the major features of your project?",
                "The major features are: (1) Gasless voting via backend relayer, (2) Salted Keccak-256 voter nullifiers, (3) Sensor-driven 240-degree Android motion liveness check, (4) AWS Rekognition facial quality gate, (5) Bounded re-voting (first vote + 1 change), (6) Polling station physical override, (7) 2-of-3 guardian multi-signature UUPS contract governance, and (8) An independent public audit verification route.",
                "The system combines native Android (Jetpack Compose, CameraX, ML Kit) with a Next.js 15 backend, MongoDB Atlas, and an upgradeable Solidity 0.8.22 smart contract deployed on Ethereum Sepolia. All operations are backed by 190 automated unit and adversarial tests.",
                "Each feature addresses a specific threat vector: the relayer solves user adoption, the nullifier solves privacy, re-voting solves home coercion, and multi-sig solves malicious administrator attacks.",
                "docs/paper/BlockVote_IEEE_merged.tex (Section I & III) and ARCHITECTURE.md."
            ),
            (
                "Q6. What makes BlockVote different from a normal online voting system?",
                "In a normal online voting system, vote tallies are stored in a regular database table where anyone with database access can update the rows without detection. In BlockVote, the vote tally is stored in an immutable Ethereum smart contract where transactions are cryptographically signed, permanent, and publicly auditable.",
                "Furthermore, unlike normal web portals, BlockVote separates voter authentication from on-chain storage using salted nullifiers so the database administrator cannot link a voter's email to their candidate choice on the blockchain. It also incorporates physical sensor liveness and physical kiosk overrides.",
                "Because trust in election results cannot depend on trusting a single database administrator or hosting company; blockchain ensures that once cast, no entity can manipulate the tally.",
                "Voting/contracts/VotingV3.sol (voteChoice mapping and candidates voteCount)."
            ),
            (
                "Q7. Explain the complete working of your project.",
                "An election admin logs into the web dashboard, creates an election, adds candidates, and uploads an eligible voter CSV. The system dispatches email invite links. The voter opens the Android app via deep link, enters their email, and receives an OTP. Next, the voter performs a 240-degree sensor-driven face rotation scan verified by AWS Rekognition to prove liveness. Once authenticated, the voter selects a candidate and submits the OTP. The backend atomically reserves a vote slot and forwards the vote through a serialized gasless relayer to the VotingV3 smart contract on Sepolia. The contract updates the tally and emits a salted private event, after which the voter receives a transaction hash confirmation.",
                "The working cleanly decouples off-chain identity verification (Next.js, MongoDB, AWS Rekognition, Resend) from on-chain state execution (ethers.js, Sepolia, VotingV3).",
                "Because keeping identity off-chain protects privacy, while putting the vote counting on-chain ensures mathematical trust and immutability.",
                "ARCHITECTURE.md and docs/paper/figures/fig_sequence.pdf."
            ),
            (
                "Q8. Explain the complete voting flow from user login to vote confirmation.",
                "1. User receives an email with an HTTPS link and opens the Android app.<br>2. App calls GET /api/elections/{id} and fetches candidate details.<br>3. Voter inputs their email; app requests OTP via POST /api/auth/send-otp.<br>4. App launches CameraX front camera and PhoneRotationTracker; user rotates phone 240 degrees while ML Kit verifies a single face.<br>5. App captures frame and calls POST /api/biometric/verify (AWS Rekognition); server returns a 10-minute biometric JWT.<br>6. Voter selects candidate and submits OTP with JWT to POST /api/auth/verify-otp.<br>7. Server verifies OTP via bcrypt, validates JWT, checks vote allowance in MongoDB, and enqueues transaction in relay.js.<br>8. Relayer executes castVoteRelayedV3() on Ethereum Sepolia using its own gas.<br>9. Transaction receipt is logged, email receipt is dispatched, and voter views confirmation.",
                "Step 7 uses reserveVoteSlot() in MongoDB to atomically guarantee that concurrency cannot breach the 2-vote limit before the Ethereum transaction confirms.",
                "To ensure that both biometric liveness and email ownership are proven simultaneously before triggering the irreversible on-chain transaction.",
                "Voting/app/api/auth/verify-otp/route.js (Lines 23-280)."
            ),
            (
                "Q9. What was your role in the project?",
                "I served as the Lead Architect and Backend/Blockchain Developer (First Author on the research paper). I designed and implemented the smart contract architecture, the gasless relayer engine, the voter nullifier privacy system, and the backend authentication and verification APIs.",
                "My core responsibility was building the complete secure pipeline connecting voter authentication to Ethereum transaction confirmation, ensuring gasless execution, atomic double-vote prevention, and multi-signature governance.",
                "Because the technical complexity of integrating smart contracts with serverless backends and gasless relaying required focused architecture on security and transaction serialization.",
                "docs/paper/BlockVote_IEEE_merged.tex (Authors section: Deven Wagh) and Voting/contracts/VotingV3.sol."
            ),
            (
                "Q10. Which module did you personally work on?",
                "I personally worked on the Blockchain, Gasless Relayer, and Security Architecture module, which comprises VotingV3.sol, lib/relay.js, lib/voterIdentity.js, lib/voteLedger.js, and the core authentication endpoint verify-otp/route.js.",
                "This module is the backbone of BlockVote. It handles smart contract state, gas sponsorship, transaction queueing, nonce management, nullifier calculation, atomic slot reservations, and contract interaction via ethers.js v6.",
                "Because without this module, the project would either be a standard centralized web app or would require voters to use MetaMask and pay crypto gas fees.",
                "Voting/lib/relay.js and Voting/contracts/VotingV3.sol."
            ),
            (
                "Q11. What exactly did you implement?",
                "I implemented: (1) The UUPS-upgradeable VotingV3 smart contract with bounded re-voting and 2-of-3 guardian approvals; (2) The gasless relayer in lib/relay.js using a promise queue and NonceManager; (3) Deterministic nullifier generation using Keccak-256 and a server secret; (4) The atomic vote-slot reservation algorithm in MongoDB; (5) The complete verify-otp and biometric verification pipeline; and (6) The automated Hardhat benchmark suite cross-validating gas against 114 Sepolia transactions.",
                "In code, this spans castVoteRelayedV3() in Solidity, sendRelayTx() with 4-attempt backoff in JavaScript, computeNullifierHash() in voterIdentity.js, and reserveVoteSlot() in voteLedger.js.",
                "Each of these components was required to eliminate critical vulnerabilities: race conditions, nonce collisions, transaction fees, and ballot exposure.",
                "Voting/contracts/VotingV3.sol (Lines 371-413) and Voting/lib/relay.js (Lines 26-55)."
            ),
            (
                "Q12. Which technologies did you use for your contribution?",
                "I used Solidity 0.8.22 with OpenZeppelin Upgradeable v5.6 for the smart contract; Hardhat 2.28 for testing and compilation; ethers.js v6.15 for blockchain communication; Next.js 15 App Router (Node.js) for backend APIs; MongoDB with Mongoose for atomic ledger state; AWS SDK v3 for Rekognition; bcryptjs for OTP security; and crypto for HMAC and JWT tokens.",
                "Solidity provided memory safety and custom revert strings; ethers.js v6 provided modern BigInt and NonceManager support; MongoDB provided atomic findOneAndUpdate operations; and OpenZeppelin provided audited UUPS proxy standards.",
                "Because these are industry-standard, production-proven libraries that prevent common vulnerabilities like integer overflows, proxy storage collisions, and replay attacks.",
                "Voting/package.json (Dependencies section)."
            ),
            (
                "Q13. Which files, components, or functions did you personally develop?",
                "Key files and functions developed: (1) Voting/contracts/VotingV3.sol: functions castVoteRelayedV3(), registerVoterByRelay(), _authorizeUpgrade(); (2) Voting/lib/relay.js: functions sendRelayTx(), relayCastVote(), relayRegisterVoter(); (3) Voting/lib/voterIdentity.js: computeNullifierHash(); (4) Voting/lib/voteLedger.js: reserveVoteSlot(), releaseVoteSlot(); (5) Voting/lib/biometric.js: issueBiometricToken(), verifyBiometricToken(); (6) Voting/app/api/auth/verify-otp/route.js: POST handler; and (7) Voting/scripts/benchmark-gas.js.",
                "These functions represent the entire backend and blockchain transaction lifecycle from raw HTTP request to mined Ethereum block.",
                "Because they form the core intellectual property of the project, as documented in our research paper.",
                "Voting/contracts/VotingV3.sol, Voting/lib/relay.js, and Voting/lib/voteLedger.js."
            ),
            (
                "Q14. How is your module connected to the other modules?",
                "My module sits at the center of the system: it receives HTTP requests from the Android mobile app (developed with Compose/CameraX) and the web polling station kiosk; it queries MongoDB for voter state; it validates biometric tokens generated by the AWS Rekognition module; and it transmits signed transactions over JSON-RPC to the Ethereum Sepolia network.",
                "It serves as the bridge between off-chain identity (Next.js/Android) and on-chain consensus (Solidity/Sepolia). It translates a verified user email into a nullifier and relays their candidate choice to the smart contract.",
                "Because separating client UI, operational database, and blockchain consensus through a centralized API gateway ensures security boundaries are enforced before touching the blockchain.",
                "ARCHITECTURE.md (Architecture Diagram) and Voting/app/api/auth/verify-otp/route.js."
            ),
            (
                "Q15. What was the most challenging part of your contribution?",
                "The most challenging part was solving the Ethereum nonce collision problem during concurrent voting bursts. When multiple voters submit ballots simultaneously, a single relayer wallet attempting to send transactions concurrently will fail with 'nonce too low' or 'replacement fee too low' errors.",
                "I solved this by designing a two-tier mechanism: first, wrapping the ethers.js wallet in an ethers.NonceManager; second, routing all transactions through a serialized JavaScript promise queue (enqueueRelay in relay.js) with linear backoff retry logic. This guaranteed that transactions are broadcast sequentially and receipts confirmed without collision.",
                "Because on a public blockchain like Sepolia, transactions from the same account must have strictly sequential nonces; broadcasting out of order causes instant reverts.",
                "Voting/lib/relay.js (Lines 26-55: enqueueRelay and sendRelayTx)."
            ),
            (
                "Q16. If your module is removed, what functionality will be affected?",
                "If my module is removed, the entire blockchain integration collapses: voters would be unable to cast votes gaslessly; smart contracts could not execute; voter nullifiers could not be computed; and MongoDB would suffer race conditions from duplicate ballot submissions.",
                "The Android app and web dashboard would become completely non-functional shells unable to authenticate voters, register candidates on-chain, or tally election results.",
                "Because my module contains the core business logic, security rules, and blockchain relay mechanism that powers the entire BlockVote ecosystem.",
                "Voting/lib/relay.js and Voting/contracts/VotingV3.sol."
            ),
            (
                "Q17. How do you protect the voter's identity?",
                "We protect voter identity through three layers: (1) On-chain nullifiers—the blockchain never sees an email or name, only a salted Keccak-256 hash; (2) Blinded events—the smart contract emits a salted commitment hash instead of the candidate ID; and (3) Decoupled receipts—email receipts contain only the transaction hash, never the candidate chosen.",
                "Even if an attacker analyzes all public transactions on Etherscan, they see only a nullifier hash and a blinded ballot hash. They cannot discover who voted or for whom they voted.",
                "Because secret ballots are a fundamental democratic requirement; publishing identifiable votes on a public ledger would enable vote-buying and voter intimidation.",
                "Voting/contracts/VotingV3.sol (VoteCastPrivate event) and Voting/lib/voterIdentity.js."
            ),
            (
                "Q18. Why shouldn't the voter's identity be directly linked to their vote?",
                "If a voter's identity is directly linked to their ballot, anyone can see who they voted for. This leads to vote-buying (bribery) because voters can prove their choice to a buyer, and voter coercion (intimidation) because bosses, politicians, or peers can punish voters for their choices.",
                "In voting theory, this is known as Ballot Secrecy and Receipt-Freeness. BlockVote ensures that while the system can prove a legitimate voter participated, no one—not even the voter themselves—can obtain a cryptographic proof of which candidate was selected.",
                "Because an election without ballot secrecy ceases to be free and fair; voters would vote out of fear rather than personal conviction.",
                "docs/paper/BlockVote_IEEE_merged.tex (Section II: Privacy and Coercion)."
            ),
            (
                "Q19. What is hashing?",
                "Hashing is a one-way mathematical function that transforms any arbitrary input data into a fixed-length string of bytes. It is deterministic (the same input always produces the same output), quick to compute, but computationally infeasible to reverse (one-way property) or find two different inputs that produce the same hash (collision resistance).",
                "Common cryptographic hash algorithms include SHA-256 and Keccak-256 (used in Ethereum). In BlockVote, hashing is used for passwords (bcrypt), biometric landmarks (HMAC-SHA256), voter nullifiers (Keccak-256), and ballot commitments (Keccak-256).",
                "Because hashing allows us to verify data integrity and compare identities without storing or exposing the underlying sensitive data.",
                "Voting/lib/voterIdentity.js (ethers.keccak256)."
            ),
            (
                "Q20. Why do you use hashing in BlockVote?",
                "We use hashing for three essential purposes: (1) Identity Masking: transforming voter emails into pseudo-anonymous nullifiers; (2) Ballot Blinding: emitting salted ballot hashes on-chain so external observers cannot tally votes before polls close; and (3) Credential Security: storing OTPs as bcrypt hashes to prevent database theft.",
                "Without hashing, either plaintext emails and choices would sit on the public blockchain for anyone to inspect, or passwords and OTPs would be stored in plain text in MongoDB.",
                "Because Ethereum is a public distributed ledger; any data written to it is permanently readable by the entire world.",
                "Voting/contracts/VotingV3.sol (ballotHash computation) and Voting/lib/voterIdentity.js."
            ),
            (
                "Q21. What is a nullifier?",
                "A nullifier is a cryptographically derived pseudonym that uniquely represents a voter in an election without revealing their actual identity. It acts as a one-way ticket that proves eligibility and prevents duplicate participation.",
                "In cryptography and zero-knowledge voting protocols, a nullifier is published when an action is taken. Once a nullifier is recorded in the smart contract's isRegisteredVoter or hasVoted mapping, any second attempt using the same nullifier is instantly detected and rejected.",
                "Because the smart contract needs a unique key to know if someone is registered and whether they have voted, but using their email address or public wallet address would destroy their privacy.",
                "Voting/contracts/VotingV3.sol (Lines 117-124) and docs/paper/BlockVote_IEEE_merged.tex (Equation 1)."
            ),
            (
                "Q22. Why did you use a nullifier?",
                "We used a nullifier so that the smart contract can enforce strict one-person-one-vote rules while keeping the blockchain completely free of Personally Identifiable Information (PII).",
                "If we used wallet addresses, voters would need MetaMask. If we used email strings, voter emails would be permanently visible on Etherscan, exposing users to spam and doxxing. The nullifier solves both problems elegantly.",
                "Because institutional privacy standards and data protection regulations (like GDPR and India's DPDP Act) prohibit publishing user emails to public immutable ledgers.",
                "Voting/lib/voterIdentity.js (Lines 8-14)."
            ),
            (
                "Q23. What information is used to generate the nullifier?",
                "The nullifier is generated using two pieces of information: (1) The voter's cleaned, lowercase email address, and (2) A 256-bit server-side secret key called SERVER_IDENTITY_SECRET.",
                "The formula is: keccak256(toUtf8Bytes(cleanEmail + ':' + SERVER_IDENTITY_SECRET)). By combining the email with a high-entropy secret, we prevent rainbow table attacks where an attacker hashes common college emails to see if they match the on-chain nullifier.",
                "Because if we only hashed the email without a salt or secret, anyone with the student directory could compute keccak256(student@college.edu) and identify every voter on-chain.",
                "Voting/lib/voterIdentity.js (Lines 8-14: computeNullifierHash)."
            ),
            (
                "Q24. Can the original email/identity be obtained from the nullifier?",
                "No. Because Keccak-256 is a cryptographically secure one-way hash function, it is mathematically impossible to reverse the nullifier back to the email address.",
                "Even with a dictionary attack or brute-force attempt, an attacker cannot reverse the hash because they do not know the 256-bit SERVER_IDENTITY_SECRET. As long as this secret remains protected on the backend server, the nullifier is irreversible.",
                "Because the security of modern cryptography relies on the pre-image resistance of hash functions; breaking Keccak-256 would require 2^256 operations, which exceeds the computing power of all computers on Earth.",
                "docs/paper/BlockVote_IEEE_merged.tex (Section III-B: Voter Identity and Nullifiers)."
            ),
            (
                "Q25. How does the nullifier help prevent duplicate voting?",
                "The smart contract tracks nullifiers in mapping(bytes32 => mapping(bytes32 => bool)) public isRegisteredVoter and mapping(bytes32 => mapping(bytes32 => uint256)) public voteChoice.",
                "When a vote is relayed, the contract checks isRegisteredVoter[electionId][nullifier]. If false, it reverts. In VotingV3, if a voter submits again, the contract detects their existing choice via voteChoice[nullifier][electionId] and treats it as a re-vote (decrementing the old candidate and incrementing the new candidate) rather than adding a second vote. MongoDB also enforces votesCast < 2 atomically.",
                "Because each email maps to exactly one deterministic nullifier; a voter cannot create multiple nullifiers unless they possess multiple registered email addresses.",
                "Voting/contracts/VotingV3.sol (Lines 371-412: castVoteRelayedV3)."
            ),
            (
                "Q26. How do you separate the voter's identity from their ballot?",
                "Identity separation is achieved across three boundaries: (1) Off-chain: The voter proves their identity to Next.js using email OTP and face liveness; (2) In-transit: The backend converts the email to a nullifier and assigns a random 32-byte ballot salt; (3) On-chain: The smart contract emits VoteCastPrivate with only the salted ballot hash keccak256(electionId, candidateId, nullifier, salt).",
                "MongoDB explicitly avoids storing candidateId inside the Voter document, and stores only transaction hashes and aggregated counts in VoteActivity. Thus, the database does not link voter records to ballot choices, and the blockchain does not link nullifiers to plaintext candidate events.",
                "Because true ballot secrecy requires that no single database table or log file contains both the voter's identity and their voting decision.",
                "Voting/lib/relay.js (Lines 167-190) and Voting/contracts/VotingV3.sol (Line 408)."
            ),
            (
                "Q27. What are the privacy limitations of your current system?",
                "As honestly documented in Section IV-G of our research paper, there are three limitations: (1) The backend server and relay operator briefly see the candidate choice in memory during the HTTP request before submitting to Ethereum; (2) If SERVER_IDENTITY_SECRET were leaked alongside the voter roster, an attacker could reconstruct nullifiers and inspect voteChoice; and (3) The contract stores voteChoice indexed by nullifier, meaning someone who knows a nullifier can query their current choice.",
                "These limitations arise because we prioritize gasless usability and bounded re-voting over complex zero-knowledge snarks or threshold homomorphic encryption, which are computationally expensive on Ethereum.",
                "Because acknowledging real engineering trade-offs demonstrates deep academic maturity and honesty during viva examination.",
                "docs/paper/BlockVote_IEEE_merged.tex (Section IV-G: Limitations)."
            ),
            (
                "Q28. What did you personally learn from this project?",
                "I gained deep, end-to-end engineering experience in: (1) Writing and testing secure, gas-optimized Solidity smart contracts and UUPS proxy upgrade patterns; (2) Handling concurrency and nonce management in production Ethereum relay systems; (3) Integrating computer vision and biometric liveness using Android sensors, ML Kit, and AWS Rekognition; and (4) Conducting empirical research, gas benchmarking, and authoring an IEEE-format research paper.",
                "Most importantly, I learned that building real-world decentralized systems is not just about blockchain; it is about building robust hybrid architectures where Web2 usability seamlessly abstracts Web3 complexity for everyday users.",
                "Because theoretical knowledge of blockchain is very different from solving real race conditions, gas spikes, and adversarial presentation attacks in a live application.",
                "docs/paper/BlockVote_IEEE_merged.tex and the entire codebase."
            )
        ]

        for q_title, ans, tech, why, code in qa_data:
            f.write(f"""
<div class="q-box">
  <div class="q-title">{q_title}</div>
  <p><span class="ans-tag">Answer:</span> {ans}</p>
  <p><span class="tech-tag">Technical Explanation:</span> {tech}</p>
  <p><span class="why-tag">If Sir Asks "Why?":</span> {why}</p>
  <p><span class="code-tag">If Sir Asks "Show Me in Code":</span> <code>{code}</code></p>
</div>
""")

        # SECTION 4: PART 3 - CROSS-QUESTIONING
        f.write("""
<div class="page-break"></div>
<h2>PART 3 — CROSS-QUESTIONING (STRICT EXAMINER SIMULATION)</h2>
<p>Anticipated technical interrogation paths across 7 core areas with direct student answers.</p>

<h3>A. Role & Implementation Cross-Examination</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> What did you personally implement in this project?</p>
  <p><strong>Student:</strong> I designed and implemented the entire Blockchain, Gasless Relayer, and Security module. Specifically, VotingV3.sol in Solidity, the relayer in lib/relay.js, the nullifier derivation in lib/voterIdentity.js, the atomic vote ledger in lib/voteLedger.js, the core verify-otp route, and the automated gas benchmark suite.</p>
  <p><strong>Examiner:</strong> Show me the exact function where the vote is sent to the blockchain.</p>
  <p><strong>Student:</strong> Let's open <code>Voting/lib/relay.js</code> at line 135: <code>export async function relayCastVote(electionId, candidateId, voterNullifier, options)</code>. Here you can see it generates a 32-byte <code>ballotSalt</code>, checks previous vote status via <code>getContract().getVoteStatus()</code>, and dispatches <code>sendRelayTx()</code> which calls <code>getContract().castVoteRelayedV3(...)</code>.</p>
  <p><strong>Examiner:</strong> Why did you implement a serialized queue in relay.js instead of just firing the transactions directly?</p>
  <p><strong>Student:</strong> Because in Ethereum, every transaction sent from an account must have a strictly sequential nonce. If two voters submit votes at the exact same second, firing them directly causes a nonce collision ('nonce too low' or 'replacement transaction underpriced'). My <code>enqueueRelay()</code> promise queue forces transactions to be broadcast sequentially, waiting for confirmation before the next is sent.</p>
  <p><strong>Examiner:</strong> What happens if the relay transaction fails mid-way?</p>
  <p><strong>Student:</strong> Look at <code>Voting/lib/voteLedger.js</code> line 56: <code>releaseVoteSlot(voterId, before)</code>. In <code>verify-otp/route.js</code>, if <code>relayCastVote</code> throws an error, the catch block immediately calls <code>releaseVoteSlot()</code> which decrements <code>votesCast</code> back to its original state in MongoDB, ensuring the voter doesn't lose their voting allowance due to a network glitch.</p>
</div>

<h3>B. Blockchain & Gasless Relaying Cross-Examination</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> Why did you use blockchain at all? Why couldn't MongoDB handle this entire voting system?</p>
  <p><strong>Student:</strong> MongoDB is a centralized database. In MongoDB, an administrator with database credentials can run <code>db.candidates.updateOne({name: 'A'}, {$inc: {voteCount: 500}})</code> in MongoDB Compass, and no voter or auditor would ever know. The blockchain enforces decentralized consensus: smart contract execution rules cannot be bypassed by anyone, and every vote is immutably sealed inside Ethereum blocks.</p>
  <p><strong>Examiner:</strong> If blockchain is so secure, why didn't you store everything on-chain?</p>
  <p><strong>Student:</strong> Storing data on Ethereum is extremely expensive. Writing 1 KB of data to Ethereum storage costs over 640,000 gas. Storing photos, candidate manifestos, and logs would make the system unaffordable. Therefore, we use a hybrid model: heavy files go to IPFS and ImageKit, operational session data goes to MongoDB, and only the critical immutable state (nullifiers, vote tallies, and hashes) sits on-chain.</p>
  <p><strong>Examiner:</strong> Who pays the gas fee for the transactions?</p>
  <p><strong>Student:</strong> The election organizer/platform relayer pays all gas fees using a dedicated relay wallet (<code>ADMIN_RELAY_PRIVATE_KEY</code>). The voter pays zero gas and does not need any cryptocurrency or wallet extension.</p>
  <p><strong>Examiner:</strong> What happens if the relayer wallet runs out of ETH?</p>
  <p><strong>Student:</strong> The transaction will revert with an 'insufficient funds for gas' error. The system logs this in MongoDB, alerts the admin dashboard, and returns a clean 503 error to the voter instructing them to retry in a few moments while the admin tops up the relayer wallet.</p>
</div>

<h3>C. Gasless Voting & Nonce Management</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> What is a nonce in Ethereum?</p>
  <p><strong>Student:</strong> An account nonce is a counter indicating the number of transactions sent from a given account address. Nonces prevent double-spending and transaction replay attacks.</p>
  <p><strong>Examiner:</strong> How does your code handle nonces when 50 voters vote at once?</p>
  <p><strong>Student:</strong> We use two mechanisms in <code>Voting/lib/relay.js</code>: (1) We wrap the base wallet with <code>new ethers.NonceManager(baseWallet)</code> which locally manages nonce increments, and (2) We run all transactions through <code>sendRelayTx()</code> with a serialized promise queue and a retry loop with linear backoff (800ms * attempt) up to 4 attempts if an unexpected nonce error occurs.</p>
</div>

<h3>D. Privacy & Nullifier Cross-Examination</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> Can the database admin know who I voted for?</p>
  <p><strong>Student:</strong> In MongoDB, the <code>Voter</code> document records that the voter has voted, but does not store the <code>candidateId</code>. The candidate choice is only logged in <code>VoteActivity</code> along with a blinded <code>ballotHash</code>, without storing the voter's email or nullifier. The two collections cannot be linked. However, as noted in our paper's honest limitations, the backend server process handles the HTTP payload in memory for a fraction of a second during submission.</p>
  <p><strong>Examiner:</strong> What if an attacker steals the MongoDB database?</p>
  <p><strong>Student:</strong> They cannot tamper with the election result because the official tally is calculated by the Ethereum smart contract, not MongoDB. Furthermore, they cannot decrypt voter passwords or OTPs because they are stored as one-way bcrypt hashes.</p>
</div>

<h3>E. Authentication & Biometrics Cross-Examination</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> Why did you use AWS Rekognition instead of running face detection completely in the phone?</p>
  <p><strong>Student:</strong> We use a defense-in-depth model: on-device ML Kit performs high-speed 90ms frame evaluation to track face presence and guide the user through the 240-degree sensor rotation. But client-side code can be decompiled or manipulated. Therefore, the captured image must be verified by a secure cloud provider—AWS Rekognition—which validates face confidence, lighting, open eyes, and lack of glasses before issuing a signed biometric JWT.</p>
  <p><strong>Examiner:</strong> Can someone hold up a photograph of the voter to bypass your system?</p>
  <p><strong>Student:</strong> No. The Android app requires the user to rotate the phone continuously through 240 degrees of yaw tracked by <code>SensorManager</code>. A flat photograph held in front of the camera cannot provide the proper parallax and motion dynamics, and ML Kit immediately resets progress if another person or face enters the background.</p>
</div>

<h3>F. Smart Contract & Governance Cross-Examination</h3>
<div class="q-box">
  <p><strong>Examiner:</strong> What is UUPS, and why did you use it over Transparent Proxy?</p>
  <p><strong>Student:</strong> UUPS stands for Universal Upgradeable Proxy Standard (EIP-1822). In UUPS, the upgrade logic is stored inside the implementation contract rather than the proxy. This makes UUPS much more gas-efficient because normal calls do not need an extra delegatecall check, and it allows us to enforce custom upgrade rules, such as our 2-of-3 guardian multi-signature gate in <code>_authorizeUpgrade()</code>.</p>
  <p><strong>Examiner:</strong> Explain the underflow guard in castVoteRelayedV3.</p>
  <p><strong>Student:</strong> Look at <code>Voting/contracts/VotingV3.sol</code> line 393: When a voter changes their vote, we decrement the old candidate's vote count: <code>require(candidates[_electionId][oldCandidateId].voteCount > 0, "VotingV3: underflow guard")</code> before executing <code>candidates[_electionId][oldCandidateId].voteCount--</code>. This guarantees that an arithmetic underflow can never corrupt contract state even if state desynchronization occurred.</p>
</div>
""")

        # SECTION 5: PART 4 - CODE-BASED VIVA
        f.write("""
<div class="page-break"></div>
<h2>PART 4 — CODE-BASED VIVA PREPARATION</h2>

<h3>FILES I MUST KNOW FOR VIVA</h3>
<table>
  <thead>
    <tr>
      <th>File Path</th>
      <th>Primary Purpose</th>
      <th>Key Functions / Structs</th>
      <th>Expected Examiner Question</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>Voting/contracts/VotingV3.sol</code></td>
      <td>Core UUPS smart contract governing election state, nullifiers, re-voting, and tallies.</td>
      <td><code>castVoteRelayedV3()</code>, <code>registerVoterByRelay()</code>, <code>_authorizeUpgrade()</code>, <code>voteChoice</code> mapping.</td>
      <td>"Explain how re-voting works without double counting."</td>
    </tr>
    <tr>
      <td><code>Voting/lib/relay.js</code></td>
      <td>Gasless relayer engine that sponsors gas, manages nonces, and serializes transactions.</td>
      <td><code>sendRelayTx()</code>, <code>enqueueRelay()</code>, <code>relayCastVote()</code>, <code>logRelayTransaction()</code>.</td>
      <td>"How do you prevent nonce collisions during concurrent voting?"</td>
    </tr>
    <tr>
      <td><code>Voting/lib/voterIdentity.js</code></td>
      <td>Voter privacy module deriving deterministic on-chain nullifiers from email.</td>
      <td><code>computeNullifierHash(email)</code>.</td>
      <td>"Show me the formula used to calculate the nullifier."</td>
    </tr>
    <tr>
      <td><code>Voting/lib/voteAllowance.js</code></td>
      <td>Business rules defining voting limits across app and polling station channels.</td>
      <td><code>checkVoteAllowance()</code>, <code>MAX_APP_VOTES = 2</code>, <code>VOTE_CHANNEL</code>.</td>
      <td>"Why do you allow 2 votes in the app but only 1 at a station?"</td>
    </tr>
    <tr>
      <td><code>Voting/lib/voteLedger.js</code></td>
      <td>Concurrency control performing atomic vote slot reservations in MongoDB.</td>
      <td><code>reserveVoteSlot()</code>, <code>acquireCastLock()</code>, <code>releaseVoteSlot()</code>.</td>
      <td>"What happens if two requests arrive from the same voter simultaneously?"</td>
    </tr>
    <tr>
      <td><code>Voting/lib/biometric.js</code></td>
      <td>Biometric token management and AWS Rekognition client initialization.</td>
      <td><code>issueBiometricToken()</code>, <code>verifyBiometricToken()</code>.</td>
      <td>"What is inside the biometric token and how long does it live?"</td>
    </tr>
    <tr>
      <td><code>Voting/app/api/auth/verify-otp/route.js</code></td>
      <td>Core authentication route validating OTP, biometric token, and dispatching vote.</td>
      <td><code>POST(req)</code> handler.</td>
      <td>"Trace this route from receiving the HTTP body to returning the txHash."</td>
    </tr>
    <tr>
      <td><code>app/.../PhoneRotationTracker.kt</code></td>
      <td>Android sensor tracker monitoring 240-degree yaw rotation during liveness check.</td>
      <td><code>onSensorChanged()</code>, <code>targetDegrees = 240f</code>.</td>
      <td>"How does the phone know the user rotated 240 degrees?"</td>
    </tr>
  </tbody>
</table>

<h3>FUNCTIONS I MUST KNOW</h3>
<ul>
  <li><code>castVoteRelayedV3(bytes32 _electionId, uint256 _candidateId, bytes32 _voterNullifier, bytes32 _ballotSalt)</code>:
    <br><em>Solidity:</em> Checks if voter is registered, checks Voting phase, retrieves <code>voteChoice[nullifier][electionId]</code>. If 0 (first vote), increments candidate's <code>voteCount</code>. If &gt; 0 (re-vote), decrements old candidate's <code>voteCount</code> and increments new candidate's <code>voteCount</code>. Stores <code>_candidateId + 1</code> in <code>voteChoice</code> and emits <code>VoteCastPrivate</code>.</li>
  <li><code>computeNullifierHash(email)</code>:
    <br><em>JavaScript:</em> Cleans email to lowercase and trims whitespace, retrieves <code>SERVER_IDENTITY_SECRET</code> from environment, and returns <code>ethers.keccak256(toUtf8Bytes(`${cleanEmail}:${secret}`))</code>.</li>
  <li><code>sendRelayTx(sendFn, maxAttempts = 4)</code>:
    <br><em>JavaScript:</em> Pushes transaction function into <code>enqueueRelay()</code> promise queue. Loops up to 4 times; on nonce error, waits with linear backoff (<code>800 * attempt</code> ms) and retries. Waits for transaction receipt before completing.</li>
  <li><code>reserveVoteSlot(voterId, channel)</code>:
    <br><em>JavaScript:</em> Executes atomic MongoDB <code>Voter.findOneAndUpdate()</code> ensuring <code>stationVoteFinal != true</code> and <code>votesCast &lt; 2</code>. Increments <code>votesCast</code> by 1. Returns null if limit exceeded.</li>
  <li><code>issueBiometricToken(nullifierHash)</code>:
    <br><em>JavaScript:</em> Creates a 10-minute HS256 JWT payload containing <code>{ nullifierHash, authenticated: true, exp }</code> signed with <code>JWT_SECRET</code>.</li>
</ul>

<h3>TOP 20 CODE QUESTIONS EXAMINERS WILL ASK</h3>
<ol>
  <li><strong>Where is the smart contract deployed?</strong> Deployed on Ethereum Sepolia testnet at address specified in <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code>.</li>
  <li><strong>Show me where re-voting decrements the old candidate.</strong> In <code>VotingV3.sol</code> lines 397-398: <code>candidates[_electionId][oldCandidateId].voteCount--; candidates[_electionId][_candidateId].voteCount++;</code>.</li>
  <li><strong>Why does voteChoice store candidateId + 1?</strong> In Solidity, default mapping values are 0. If candidate ID 0 received a vote, storing 0 would mean 'not voted'. Storing <code>candidateId + 1</code> allows 0 to represent 'unvoted'.</li>
  <li><strong>How is the ballot salt generated?</strong> In <code>relay.js</code> line 137: <code>ethers.hexlify(ethers.randomBytes(32))</code>.</li>
  <li><strong>Where is the UUPS 2-of-3 guardian check?</strong> In <code>VotingV3.sol</code> lines 197-213: <code>_authorizeUpgrade()</code> checks <code>p.approvalCount >= APPROVAL_THRESHOLD</code> (which is 2).</li>
  <li><strong>What prevents a guardian from approving twice?</strong> In <code>VotingV3.sol</code> line 231: <code>require(!p.approvedBy[msg.sender], "VotingV3: already approved")</code>.</li>
  <li><strong>Show me how the OTP is verified.</strong> In <code>verify-otp/route.js</code> line 101: <code>await bcrypt.compare(String(otp).trim(), record.otp)</code>.</li>
  <li><strong>Where are OTP attempt limits enforced?</strong> In <code>verify-otp/route.js</code> line 94: <code>if (record.attempts >= 3) return error</code>.</li>
  <li><strong>Show me where the station override locks the voter.</strong> In <code>voteLedger.js</code> line 22: <code>if (channel === VOTE_CHANNEL.STATION) update.$set = { stationVoteFinal: true }</code>.</li>
  <li><strong>Where is the 240-degree sensor target defined?</strong> In <code>PhoneRotationTracker.kt</code> line 17: <code>val targetDegrees: Float = 240f</code>.</li>
  <li><strong>How does the Android app detect multiple faces?</strong> In <code>FaceCaptureCamera.kt</code> via Google ML Kit: if <code>faces.size > 1</code>, liveness state resets and shows warning.</li>
  <li><strong>Show me the AWS Rekognition call.</strong> In <code>api/biometric/verify/route.js</code> line 58: <code>await rekognition.send(new DetectFacesCommand({ Image: { Bytes: liveBuffer }, Attributes: ['ALL'] }))</code>.</li>
  <li><strong>Where are voting hours enforced?</strong> In <code>lib/votingWindow.js</code> and checked before issuing OTP or casting votes (default 07:00 to 18:00 IST).</li>
  <li><strong>Where is gas spend logged?</strong> In <code>relay.js</code> line 98: logged to MongoDB <code>RelayTransaction</code> model with <code>txHash</code>, <code>gasUsed</code>, and <code>gasCostEth</code>.</li>
  <li><strong>How do you verify inclusion without revealing the vote?</strong> Via <code>GET /api/audit/verify?txHash=...</code> which calls <code>provider.getTransactionReceipt(txHash)</code> and checks block confirmation.</li>
  <li><strong>What prevents unauthorized election creation?</strong> In <code>VotingV3.sol</code> line 252: <code>createElection</code> has the <code>onlyRelay</code> modifier.</li>
  <li><strong>Where are candidate party symbols hosted?</strong> Uploaded via <code>POST /api/uploads</code> to AWS S3 and served via HTTPS URLs.</li>
  <li><strong>Show me the NonceManager initialization.</strong> In <code>relay.js</code> line 70: <code>_relayWallet = new ethers.NonceManager(baseWallet)</code>.</li>
  <li><strong>What happens if a voter inputs the wrong OTP 3 times?</strong> The record in <code>EmailOTP</code> is locked, and the voter must request a completely new OTP.</li>
  <li><strong>Where is the 190-test benchmark executed?</strong> In Hardhat using <code>npx hardhat test</code>, executing test suites in <code>test/VotingV3.test.js</code> and <code>test/attacks.test.js</code>.</li>
</ol>
""")

        # SECTION 6: FINAL SECTION - QUICK REVISION & 5-MINUTE PITCH
        f.write("""
<div class="page-break"></div>
<h2>FINAL SECTION — QUICK REVISION & 5-MINUTE PROJECT PRESENTATION</h2>

<h3>TOP 15 QUESTIONS I MUST MASTER</h3>
<div class="q-box">
  <p><strong>1. What is BlockVote?</strong><br>A gasless, decentralized electronic voting system combining Ethereum smart contracts with Android biometric liveness and bounded re-voting.<br><em>Counter-question:</em> Why not use existing Web3 voting apps like Snapshot? (Snapshot uses off-chain IPFS signatures; BlockVote enforces on-chain state and execution without requiring voter wallets).</p>
</div>
<div class="q-box">
  <p><strong>2. How does gasless voting work?</strong><br>The voter signs in with email OTP and biometrics; a backend relayer wallet signs and broadcasts the blockchain transaction, paying all gas fees.<br><em>Counter-question:</em> Doesn't that make the relayer a central point of failure? (The relayer can delay transactions, but cannot forge votes because only registered nullifiers and verified slots are accepted on-chain).</p>
</div>
<div class="q-box">
  <p><strong>3. What is a nullifier?</strong><br>A deterministic hash: <code>keccak256(email + secret)</code> that identifies a voter on-chain without revealing their email or identity.<br><em>Counter-question:</em> What happens if two voters have the same nullifier? (Impossible unless two people share the exact same email address, which is unique per voter).</p>
</div>
<div class="q-box">
  <p><strong>4. How is duplicate voting prevented?</strong><br>On-chain: <code>isRegisteredVoter</code> checks registration and <code>voteChoice</code> updates the tally. Off-chain: MongoDB <code>reserveVoteSlot</code> atomically limits voters to 2 casts.<br><em>Counter-question:</em> Why allow 2 casts instead of 1? (To allow one change of mind, mitigating remote vote coercion).</p>
</div>
<div class="q-box">
  <p><strong>5. What is the polling station override?</strong><br>A supervised web kiosk activated by an admin cookie where an in-person vote irrevocably supersedes any previous remote app vote.<br><em>Counter-question:</em> Why is station vote final? (Because an in-person supervised voting booth provides a physically coercion-free environment).</p>
</div>
<div class="q-box">
  <p><strong>6. What is stored on-chain?</strong><br>Nullifier registration mappings, candidate vote counts, election phase, and salted private ballot hashes.<br><em>Counter-question:</em> Are candidate choices visible in transactions? (No, VotingV3 emits salted hashes <code>keccak256(e || c || n || s)</code>).</p>
</div>
<div class="q-box">
  <p><strong>7. How does re-voting affect the candidate count on-chain?</strong><br>In <code>castVoteRelayedV3</code>, the contract decrements the old candidate's vote count and increments the new candidate's count in the same transaction.<br><em>Counter-question:</em> What if the old count is zero? (Protected by an explicit underflow guard: <code>require(voteCount > 0)</code>).</p>
</div>
<div class="q-box">
  <p><strong>8. What smart contract architecture did you use?</strong><br>UUPS (Universal Upgradeable Proxy Standard, EIP-1822) written in Solidity 0.8.22 using OpenZeppelin Contracts Upgradeable v5.6.<br><em>Counter-question:</em> Who can upgrade the contract? (Only a 2-of-3 quorum of guardian hardware wallets).</p>
</div>
<div class="q-box">
  <p><strong>9. How do you prevent nonce collisions in the relayer?</strong><br>We serialize transactions using a JavaScript promise queue and manage account nonces with <code>ethers.NonceManager</code>, backed by 4 retry attempts.<br><em>Counter-question:</em> What is your measured throughput? (~300 transactions/hour on Ethereum Sepolia, bounded by block slot time).</p>
</div>
<div class="q-box">
  <p><strong>10. How does the biometric liveness check work?</strong><br>The Android app tracks a 240-degree head rotation using gyroscope sensors and ML Kit; the backend verifies image quality and open eyes via AWS Rekognition.<br><em>Counter-question:</em> Do you store the voter's face? (No, images are processed in memory and discarded; only quality attributes and transient JWTs are issued).</p>
</div>
<div class="q-box">
  <p><strong>11. How much gas does a vote cast consume?</strong><br>A first vote consumes 89,946 gas; voter registration consumes 55,697 gas; a re-vote consumes 77,478 gas.<br><em>Counter-question:</em> How much does that cost in real money? (At 1.09 gwei on Sepolia, one voter costs ~0.000159 ETH or &dollar;0.40 USD).</p>
</div>
<div class="q-box">
  <p><strong>12. How was your system tested?</strong><br>190 automated tests including 75 contract tests, 30 adversarial security scenarios (A1 to A8), and validation against 114 live Sepolia transactions.<br><em>Counter-question:</em> Did you test real attacks? (Yes, the suite tests unauthorized upgrades, out-of-range candidate IDs, salt replay, and concurrent burst submissions).</p>
</div>
<div class="q-box">
  <p><strong>13. What is the role of MongoDB if you have blockchain?</strong><br>MongoDB acts as an operational cache for voter rosters, bcrypt OTP records, rate limiting, and atomic reservation locks before blockchain relay.<br><em>Counter-question:</em> If MongoDB crashes, is the election lost? (No. All election state, candidate tallies, and nullifier registrations are permanently on Ethereum).</p>
</div>
<div class="q-box">
  <p><strong>14. Can an election admin change the election result?</strong><br>No. The admin cannot directly update candidate vote counts or modify the contract logic without 2-of-3 guardian approvals.<br><em>Counter-question:</em> Can the admin add a candidate during voting? (No. The contract strictly requires <code>phase == Registration</code> to add candidates).</p>
</div>
<div class="q-box">
  <p><strong>15. What are the main limitations of BlockVote?</strong><br>The relayer sees the plaintext candidate in HTTP transit before submitting, and liveness testing does not match against enrolled government ID photos.<br><em>Counter-question:</em> How would you fix this in future work? (Implement client-side homomorphic encryption / zero-knowledge snarks and integrate DigiLocker API).</p>
</div>

<h3>5-MINUTE PROJECT EXPLANATION (VERBAL SCRIPT)</h3>
<p><em>(Speak this naturally and confidently to your examiner)</em></p>
<div class="callout">
  <p>"Good morning/afternoon, Sir. My project is <strong>BlockVote</strong>, a Gasless, Coercion-Mitigating Decentralized E-Voting System.</p>
  <p><strong>The Problem:</strong> Traditional voting methods suffer from serious flaws: paper ballots are slow and prone to booth capturing, EVMs require physical presence, and standard online voting puts complete trust in a centralized database administrator who can silently alter vote tallies. While blockchain offers decentralized immutability, standard Web3 voting forces voters to install MetaMask, safeguard private keys, and pay gas fees in cryptocurrency—making it unusable for ordinary citizens.</p>
  <p><strong>Our Solution:</strong> BlockVote bridges this gap by combining an upgradeable Ethereum smart contract (<code>VotingV3</code>) with a gasless backend relayer and native Android client. The voter never touches cryptocurrency: our platform relayer wallet pays all gas fees while serializing transactions through a promise queue with <code>ethers.NonceManager</code> to prevent nonce collisions.</p>
  <p><strong>Privacy & Anti-Coercion:</strong> To guarantee voter privacy, voter email addresses are never written to the blockchain; instead, we derive a deterministic <code>keccak256</code> nullifier using a server-side secret. Furthermore, the contract emits blinded ballot commitments rather than candidate IDs. To defeat voter coercion at home, BlockVote implements <em>bounded re-voting</em>—allowing a remote voter to cast a ballot and change it once—and a <em>supervised polling station override</em>, where an in-person kiosk ballot is final and overrides remote votes.</p>
  <p><strong>Authentication & Architecture:</strong> Voters authenticate via email OTP and biometric facial liveness. On Android, we track a 240-degree head rotation using hardware gyroscope sensors and Google ML Kit, followed by AWS Rekognition cloud validation. Privileged administrator actions and smart contract upgrades are governed by a 2-of-3 guardian multi-signature threshold under the UUPS proxy standard.</p>
  <p><strong>My Contribution & Results:</strong> As lead architect, I implemented the <code>VotingV3.sol</code> smart contract, the gasless relayer in <code>relay.js</code>, the nullifier derivation, atomic MongoDB concurrency ledgers, and the verification pipeline. We thoroughly evaluated the system with 190 automated tests (including 30 adversarial security attack scenarios) and benchmarked gas across 114 live transactions on Ethereum Sepolia, demonstrating that a ballot costs just 89,946 gas (approximately &dollar;0.40 USD at median testnet gas prices).</p>
  <p>BlockVote proves that we can achieve the mathematical immutability and auditability of blockchain without sacrificing user simplicity or voter privacy. Thank you, Sir. I am ready for your questions."</p>
</div>

</body>
</html>
""")

    print(f"Successfully generated HTML guide at: {html_path}")

    # Compile to PDF using Edge headless
    print("Compiling HTML to PDF using Microsoft Edge headless...")
    edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if os.path.exists(edge_exe):
        cmd = [
            edge_exe,
            "--headless",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            html_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(pdf_path):
            print(f"SUCCESS: Generated PDF Guide at {pdf_path} (Size: {os.path.getsize(pdf_path)} bytes)")
        else:
            print(f"Edge execution finished with code {res.returncode}. Stderr: {res.stderr}")
    else:
        print(f"Edge executable not found at {edge_exe}")

if __name__ == "__main__":
    main()
