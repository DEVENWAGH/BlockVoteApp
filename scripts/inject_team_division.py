# -*- coding: utf-8 -*-
"""
Helper script to inject Team Division section into build_full_guide.py and regenerate the PDF.
"""
import os
import subprocess

TEAM_DIVISION_HTML = """
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
"""

# Read build_full_guide.py
with open("scripts/build_full_guide.py", "r", encoding="utf-8") as f:
    content = f.read()

# Target insertion point: right after Part 1 Overview (before Part 2 Questions)
target = '<h2>PART 2 — VIVA QUESTIONS AND ANSWERS (ALL 28 QUESTIONS)</h2>'
if target in content and "TEAM WORK DIVISION: WHO IMPLEMENTED WHAT" not in content:
    new_content = content.replace(target, TEAM_DIVISION_HTML + "\n" + target)
    with open("scripts/build_full_guide.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully injected Team Division section into build_full_guide.py")
else:
    print("Target already modified or not found")
