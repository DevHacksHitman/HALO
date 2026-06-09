// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Execution} from "./HaloTypes.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title HaloVerifier
/// @notice Builds the ERC20 transfer payload used to pay Venice/x402 invoices.
/// @dev This contract never holds funds. The donor Smart Account executes the returned payload later.
contract HaloVerifier {
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Builds a USDC transfer execution for Venice API fee settlement.
    /// @dev target is the USDC token contract; the Venice paymaster is encoded inside transfer calldata.
    function constructX402Payment(address usdcToken, address venicePaymaster, uint256 feeAmount)
        external
        pure
        returns (Execution memory)
    {
        if (usdcToken == address(0) || venicePaymaster == address(0)) revert ZeroAddress();
        if (feeAmount == 0) revert ZeroAmount();

        return Execution({
            target: usdcToken,
            value: 0,
            data: abi.encodeWithSelector(IERC20.transfer.selector, venicePaymaster, feeAmount)
        });
    }
}

