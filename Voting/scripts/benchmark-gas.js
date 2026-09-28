/**
 * Gas benchmark for VotingV3 (UUPS proxy) on the in-process Hardhat network.
 * Run: npx hardhat run scripts/benchmark-gas.js --network hardhat
 *      BENCH_CONTRACT=VotingV1 npx hardhat run scripts/benchmark-gas.js --network hardhat  (one-shot baseline)
 * Prints per-operation gas statistics as JSON (used for the evaluation section of the paper).
 */
import hre from "hardhat";

const VOTERS = Number(process.env.BENCH_VOTERS || 50);
const CANDIDATES = 3;
const CONTRACT = process.env.BENCH_CONTRACT || "VotingV3";
const IS_V1 = CONTRACT === "VotingV1";

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
  };
}

async function gasOf(txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  return Number(receipt.gasUsed);
}

async function main() {
  const { ethers, upgrades } = hre;
  const [relay, g1, g2, g3] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory(CONTRACT);
  const proxy = await upgrades.deployProxy(
    Factory,
    [relay.address, g1.address, g2.address, g3.address],
    { kind: "uups", initializer: "initialize" },
  );
  await proxy.waitForDeployment();
  const deployReceipt = await proxy.deploymentTransaction().wait();
  const contract = proxy.connect(relay);

  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const create = await contract.createElection(
    "Benchmark Election", "Gas benchmark", "", now + 60, now + 7 * 86400,
  );
  const createReceipt = await create.wait();
  const electionId = (await contract.getAllElectionIds()).at(-1);

  const addCandidate = [];
  for (let i = 0; i < CANDIDATES; i++) {
    addCandidate.push(await gasOf(contract.addCandidate(
      electionId, `Candidate ${i + 1}`, `Party ${i + 1}`, "https://example.org/symbol.png", "Manifesto text", "https://example.org/photo.png",
    )));
  }

  const nullifiers = Array.from({ length: VOTERS }, (_, i) =>
    ethers.keccak256(ethers.toUtf8Bytes(`voter${i}@bench.local:secret`)));

  const register = [];
  for (const n of nullifiers) register.push(await gasOf(contract.registerVoterByRelay(electionId, n)));

  await ethers.provider.send("evm_increaseTime", [120]);
  await ethers.provider.send("evm_mine", []);
  const toVoting = await gasOf(contract.transitionPhase(electionId, 1));

  const firstVote = [];
  for (let i = 0; i < nullifiers.length; i++) {
    firstVote.push(await gasOf(IS_V1
      ? contract.castVoteRelayed(electionId, i % CANDIDATES, nullifiers[i])
      : contract.castVoteRelayedV3(electionId, i % CANDIDATES, nullifiers[i], ethers.hexlify(ethers.randomBytes(32)))));
  }

  const revoteChange = [];
  const revoteSame = [];
  for (let i = 0; !IS_V1 && i < nullifiers.length; i++) {
    const salt = ethers.hexlify(ethers.randomBytes(32));
    if (i % 2 === 0) {
      revoteChange.push(await gasOf(contract.castVoteRelayedV3(
        electionId, (i + 1) % CANDIDATES, nullifiers[i], salt)));
    } else {
      revoteSame.push(await gasOf(contract.castVoteRelayedV3(
        electionId, i % CANDIDATES, nullifiers[i], salt)));
    }
  }

  const toCompleted = await gasOf(contract.transitionPhase(electionId, 2));

  const results = await contract.getElectionResults(electionId);
  const total = results.reduce((acc, c) => acc + Number(c.voteCount), 0);

  console.log(JSON.stringify({
    contract: CONTRACT,
    network: hre.network.name,
    solc: hre.config.solidity.compilers?.[0]?.version ?? hre.config.solidity.version,
    voters: VOTERS,
    candidates: CANDIDATES,
    deployProxyTx: Number(deployReceipt.gasUsed),
    createElection: Number(createReceipt.gasUsed),
    addCandidate: stats(addCandidate),
    registerVoter: stats(register),
    transitionToVoting: toVoting,
    firstVote: stats(firstVote),
    revoteChangedCandidate: IS_V1 ? null : stats(revoteChange),
    revoteSameCandidate: IS_V1 ? null : stats(revoteSame),
    transitionToCompleted: toCompleted,
    tallyConserved: total === VOTERS,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
