// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HaloAlmoner} from "../src/HaloAlmoner.sol";

/// @notice Minimal deploy helper kept dependency-free for Step 1.
/// @dev A broadcast-ready forge-std Script can replace this once network addresses are finalized.
contract DeployHalo {
    function deploy(
        address usdcToken,
        address venicePaymaster,
        address verifierAgent,
        address treasurerAgent,
        address allowedTargetEnforcer,
        address erc20TransferRecipientEnforcer,
        address erc20SpendLimitEnforcer
    ) external returns (HaloAlmoner) {
        return new HaloAlmoner(
            usdcToken,
            venicePaymaster,
            verifierAgent,
            treasurerAgent,
            allowedTargetEnforcer,
            erc20TransferRecipientEnforcer,
            erc20SpendLimitEnforcer
        );
    }
}

