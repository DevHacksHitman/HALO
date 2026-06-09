// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Execution} from "./HaloTypes.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title HaloTreasurer
/// @notice Builds the ERC20 transfer payload used to pay approved requester grants.
/// @dev This contract never holds funds. The donor Smart Account executes the returned payload later.
contract HaloTreasurer {
    error ZeroAddress();
    error ZeroAmount();

    /// @notice Builds a USDC transfer execution for an approved grant recipient.
    /// @dev target is the USDC token contract; the requester is encoded inside transfer calldata.
    function constructGrantPayout(address usdcToken, address requester, uint256 amount)
        external
        pure
        returns (Execution memory)
    {
        if (usdcToken == address(0) || requester == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        return Execution({
            target: usdcToken, value: 0, data: abi.encodeWithSelector(IERC20.transfer.selector, requester, amount)
        });
    }
}

