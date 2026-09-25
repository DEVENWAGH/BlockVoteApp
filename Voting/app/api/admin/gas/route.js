import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getRpcUrl } from '@/lib/serverEnv';

export async function GET() {
  try {
    const rpcUrl = getRpcUrl();
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Relayer address: derived from ADMIN_RELAY_PRIVATE_KEY or ADMIN_RELAY_ADDRESS
    const relayerPrivateKey = process.env.ADMIN_RELAY_PRIVATE_KEY;
    let relayerAddress = process.env.ADMIN_RELAY_ADDRESS;
    if (relayerPrivateKey && !relayerAddress) {
      const wallet = new ethers.Wallet(relayerPrivateKey);
      relayerAddress = wallet.address;
    }
    // Gas Station address: derived from DEPLOYER_PRIVATE_KEY or NEXT_PUBLIC_DEPLOYER_ADDRESS
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    let deployerAddress = process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS;
    if (deployerPrivateKey && !deployerAddress) {
      const wallet = new ethers.Wallet(deployerPrivateKey);
      deployerAddress = wallet.address;
    }
    let relayerBalanceETH = '0.0000';
    let gasStationBalanceETH = '0.0000';

    try {
      const relBal = await provider.getBalance(relayerAddress);
      relayerBalanceETH = ethers.formatEther(relBal);
    } catch (e) {
      console.warn('Failed to fetch relayer balance:', e.message);
    }

    try {
      const gasBal = await provider.getBalance(deployerAddress);
      gasStationBalanceETH = ethers.formatEther(gasBal);
    } catch (e) {
      console.warn('Failed to fetch gas station balance:', e.message);
    }

    return NextResponse.json({
      relayerAddress,
      relayerBalanceETH: parseFloat(relayerBalanceETH).toFixed(4),
      gasStationAddress: deployerAddress,
      gasStationBalanceETH: parseFloat(gasStationBalanceETH).toFixed(4),
    });
  } catch (err) {
    console.error('[api/admin/gas GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch gas data' }, { status: 500 });
  }
}
