import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getRpcUrl } from '@/lib/serverEnv';

/** Local-chain helper: tops up the relay wallet from the deployer. Disabled in production. */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const rpcUrl = getRpcUrl();
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const relayerPrivateKey = process.env.ADMIN_RELAY_PRIVATE_KEY;
    let relayerAddress = process.env.ADMIN_RELAY_ADDRESS;
    if (relayerPrivateKey && !relayerAddress) {
      relayerAddress = new ethers.Wallet(relayerPrivateKey).address;
    }
    if (!relayerAddress) {
      return NextResponse.json({ error: 'Relay wallet not configured' }, { status: 400 });
    }

    // Deployer/Gas Station address: derived from DEPLOYER_PRIVATE_KEY
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerPrivateKey) {
      return NextResponse.json({ error: 'Deployer private key not configured' }, { status: 400 });
    }

    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
    const deployerAddress = deployerWallet.address;

    // Check if they are the same wallet (e.g. Sepolia configured with same key)
    if (deployerAddress.toLowerCase() === relayerAddress.toLowerCase()) {
      return NextResponse.json({
        success: true,
        message: 'Deployer and Relayer use the same wallet address on Sepolia. Please fund the wallet manually if needed.',
      });
    }

    // Transfer 5.0 ETH from Deployer to Relayer (for local nodes or funded deployer accounts)
    try {
      const tx = await deployerWallet.sendTransaction({
        to: relayerAddress,
        value: ethers.parseEther('5.0'),
      });
      await tx.wait();
      return NextResponse.json({
        success: true,
        message: `Successfully transferred 5.0 ETH from Deployer to Relayer! Tx: ${tx.hash}`,
      });
    } catch (err) {
      console.warn('Auto-transfer failed:', err.message);
      return NextResponse.json({
        error: `Could not auto-transfer: ${err.message}. Please fund ${relayerAddress} manually.`,
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[api/admin/gas/fund POST]', err);
    return NextResponse.json({ error: err.message || 'Funding failed' }, { status: 500 });
  }
}
