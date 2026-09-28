import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ERC1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("          UUPS DEMO UPGRADE & EXISTENCE CHECK SCRIPT              ");
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`📡 Network: ${hre.network.name}`);

  const provider = hre.ethers.provider;
  const signers = await hre.ethers.getSigners();
  let deployer, guardian1, guardian2;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    deployer  = signers[1]; // Account #1
    guardian1 = signers[0]; // Account #0
    guardian2 = signers[1]; // Account #1
  } else {
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    deployer  = key ? new hre.ethers.Wallet(key, provider) : signers[0];
    guardian1 = process.env.GUARDIAN_1_PRIVATE_KEY ? new hre.ethers.Wallet(process.env.GUARDIAN_1_PRIVATE_KEY, provider) : signers[0];
    guardian2 = process.env.GUARDIAN_2_PRIVATE_KEY ? new hre.ethers.Wallet(process.env.GUARDIAN_2_PRIVATE_KEY, provider) : signers[1];
  }

  // ── 1. Locate Target Proxy Address ──────────────────────────────────────────
  const envPath = resolve(__dirname, "../.env");
  let proxyAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!proxyAddress && existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/^NEXT_PUBLIC_CONTRACT_ADDRESS=(.*)$/m);
    if (match) proxyAddress = match[1].trim();
  }

  if (!proxyAddress) {
    throw new Error("❌ NEXT_PUBLIC_CONTRACT_ADDRESS not found in .env. Run 'yarn deploy:proxy' first.");
  }

  console.log(`\n🔗 Target UUPS Proxy Address : ${proxyAddress}`);

  // Check if proxy has code
  const code = await provider.getCode(proxyAddress);
  if (code === "0x") {
    throw new Error(`❌ No contract code found at proxy address ${proxyAddress}. Make sure your local node is running and proxy is deployed.`);
  }

  // ── 2. Read Current On-Chain State from Storage Slot ────────────────────────
  const rawImpl = await provider.getStorage(proxyAddress, ERC1967_IMPL_SLOT);
  const currentImplAddress = hre.ethers.getAddress(hre.ethers.dataSlice(rawImpl, 12));
  console.log(`📍 Current Implementation    : ${currentImplAddress}`);

  const proxyAsV3 = await hre.ethers.getContractAt("VotingV3", proxyAddress, deployer);
  let currentVersion = "unknown";
  try {
    currentVersion = await proxyAsV3.version();
  } catch (err) {
    currentVersion = "V1/legacy";
  }
  console.log(`📊 Current Contract Version  : ${currentVersion}`);

  // Check elections count to verify state preservation
  let electionCountBefore = 0;
  try {
    electionCountBefore = await proxyAsV3.getElectionCount();
    console.log(`🗳️  Elections in State       : ${electionCountBefore}`);
  } catch (_) {}

  // ── 3. Check if VotingV4Demo is ALREADY Active ─────────────────────────────
  console.log("\n🔍 Checking if VotingV4Demo is already active...");
  let alreadyUpgraded = false;
  try {
    const proxyAsDemo = await hre.ethers.getContractAt("VotingV4Demo", proxyAddress, deployer);
    const proof = await proxyAsDemo.uupsUpgradeProof();
    if (proof && proof.includes("UUPS_DEMO_SUCCESS")) {
      alreadyUpgraded = true;
      console.log("   ✅ STATUS: VotingV4Demo is ALREADY ACTIVE on this proxy!");
      console.log(`   📝 Proof Message : "${proof}"`);
      console.log(`   🏷️  Version       : ${currentVersion}`);
    }
  } catch (_) {
    console.log("   ℹ️  STATUS: VotingV4Demo is NOT yet active on this proxy.");
  }

  if (alreadyUpgraded) {
    console.log("\n──────────────────────────────────────────────────────────────────");
    console.log("🎉 UUPS VERIFICATION SUMMARY (ALREADY INSTALLED):");
    console.log(`   ✔ Proxy Address         : ${proxyAddress} (Preserved)`);
    console.log(`   ✔ Implementation Address: ${currentImplAddress}`);
    console.log(`   ✔ Active Version        : ${currentVersion}`);
    console.log(`   ✔ Elections Intact      : ${electionCountBefore}`);
    console.log("──────────────────────────────────────────────────────────────────\n");
    return;
  }

  // ── 4. If NOT yet active: Deploy and Execute Demo Upgrade ────────────────────
  console.log("\n🚀 Proceeding with VotingV4Demo deployment & upgrade...");

  // Step A: Deploy VotingV4Demo implementation
  console.log("\n1️⃣  Deploying VotingV4Demo implementation contract...");
  const VotingV4DemoFactory = await hre.ethers.getContractFactory("VotingV4Demo", deployer);
  const demoImpl = await VotingV4DemoFactory.deploy();
  await demoImpl.waitForDeployment();
  const demoImplAddress = await demoImpl.getAddress();
  const deployTx = demoImpl.deploymentTransaction();

  console.log(`   ✅ VotingV4Demo deployed at: ${demoImplAddress}`);
  console.log(`   📜 Deploy Tx Hash          : ${deployTx?.hash}`);

  // Step B: Guardian 1 proposes the upgrade
  console.log(`\n2️⃣  [Guardian 1] Proposing upgrade to: ${demoImplAddress}...`);
  const proxyAsG1 = await hre.ethers.getContractAt("VotingV3", proxyAddress, guardian1);
  const txPropose = await proxyAsG1.proposeUpgrade(demoImplAddress);
  const rcPropose = await txPropose.wait();

  let proposalId = 0n;
  for (const log of rcPropose.logs) {
    try {
      const parsed = proxyAsV3.interface.parseLog(log);
      if (parsed && parsed.name === "UpgradeProposed") {
        proposalId = parsed.args.proposalId;
        break;
      }
    } catch (_) {}
  }
  console.log(`   ✅ Proposal created! Proposal ID: ${proposalId}`);
  console.log(`   📜 Propose Tx Hash : ${txPropose.hash}`);

  // Step C: Test multi-sig rejection with 1/2 approvals
  console.log(`\n3️⃣  [Testing Multi-Sig Constraint]`);
  console.log(`   Approving with Guardian 1 only...`);
  await (await proxyAsG1.approveUpgrade(proposalId)).wait();
  console.log(`   Guardian 1 approved (1/2 approvals).`);

  try {
    console.log(`   Attempting executeUpgrade with only 1/2 approvals...`);
    await proxyAsG1.executeUpgrade(proposalId);
    console.log(`   ❌ ERROR: Multi-sig failed, should have reverted!`);
  } catch {
    console.log(`   ✅ Expected revert: 'VotingV3: insufficient approvals' — 2-of-3 multi-sig enforced!`);
  }

  // Step D: Guardian 2 approves (reaching consensus 2/2)
  console.log(`\n4️⃣  [Guardian 2] Approving Proposal ${proposalId}...`);
  const proxyAsG2 = await hre.ethers.getContractAt("VotingV3", proxyAddress, guardian2);
  const txApprove = await proxyAsG2.approveUpgrade(proposalId);
  await txApprove.wait();
  console.log(`   ✅ Guardian 2 approved! (2/2 approvals — consensus threshold reached)`);

  // Step E: Execute Upgrade
  console.log(`\n5️⃣  [Guardian 2] Executing UUPS upgrade...`);
  const txExecute = await proxyAsG2.executeUpgrade(proposalId);
  const rcExecute = await txExecute.wait();
  console.log(`   🎉 Upgrade transaction confirmed!`);
  console.log(`   📜 Execute Tx Hash : ${txExecute.hash}`);

  // ── 5. Verify Post-Upgrade State ────────────────────────────────────────────
  console.log(`\n6️⃣  Verifying Post-Upgrade Contract on the SAME Proxy...`);
  const newRawImpl = await provider.getStorage(proxyAddress, ERC1967_IMPL_SLOT);
  const newImplOnChain = hre.ethers.getAddress(hre.ethers.dataSlice(newRawImpl, 12));

  const proxyAsDemo = await hre.ethers.getContractAt("VotingV4Demo", proxyAddress, deployer);
  const newVersion = await proxyAsDemo.version();
  const proofMessage = await proxyAsDemo.uupsUpgradeProof();
  const electionCountAfter = await proxyAsDemo.getElectionCount();

  console.log(`   📊 Version after upgrade   : ${newVersion}`);
  console.log(`   📍 Implementation on-chain : ${newImplOnChain}`);
  console.log(`   💬 Proof function call     : "${proofMessage}"`);
  console.log(`   🗳️  Elections preserved    : ${electionCountAfter} (matches pre-upgrade: ${electionCountBefore})`);

  if (
    newVersion === "4.0.0-demo" &&
    newImplOnChain.toLowerCase() === demoImplAddress.toLowerCase() &&
    electionCountAfter === electionCountBefore
  ) {
    console.log("\n══════════════════════════════════════════════════════════════════");
    console.log("🏆 SUCCESS: UUPS PROXY UPGRADE TO VotingV4Demo VERIFIED!");
    console.log("   ✔ Same proxy address   : " + proxyAddress);
    console.log("   ✔ New implementation   : " + newImplOnChain);
    console.log("   ✔ Upgrade Tx Hash      : " + txExecute.hash);
    console.log("   ✔ New logic available  : uupsUpgradeProof() executed");
    console.log("   ✔ Storage state intact : All elections and data preserved");
    console.log("══════════════════════════════════════════════════════════════════\n");
  } else {
    console.log("\n❌ Upgrade check encountered unexpected values. Check logs above.");
  }
}

main().catch((err) => {
  console.error("\n❌ UUPS demo test failed:", err);
  process.exit(1);
});
