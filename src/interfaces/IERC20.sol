// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC20 interface for payload construction.
/// @dev We only need the selector; execution and return-value handling happen in the Smart Account path.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

