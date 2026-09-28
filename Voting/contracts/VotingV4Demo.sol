// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./VotingV3.sol";

/**
 * @title VotingV4Demo
 * @notice Demo upgrade implementation to test and prove UUPS upgradeability.
 *         - Inherits from VotingV3 to preserve full storage layout
 *         - Overrides version() to return "4.0.0-demo"
 *         - Adds a new demo verification function `uupsUpgradeProof()`
 */
contract VotingV4Demo is VotingV3 {
    // ─── Demo Upgrade Proof Functions ──────────────────────────────────────────
    
    /**
     * @notice Proves that the new logic contract code is active through the proxy.
     */
    function uupsUpgradeProof() external pure returns (string memory) {
        return "UUPS_DEMO_SUCCESS: New logic contract active. Proxy address and state preserved!";
    }

    /**
     * @notice Overridden version returning "4.0.0-demo".
     */
    function version() external pure override returns (string memory) {
        return "4.0.0-demo";
    }

    /**
     * @notice Extra demo greeting for verification.
     */
    function demoGreeting() external pure returns (string memory) {
        return "Hello from VotingV4Demo! The UUPS contract upgrade is live.";
    }
}
