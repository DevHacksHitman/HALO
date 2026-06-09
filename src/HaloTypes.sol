// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A local mirror of the caveat shape used by delegation systems.
/// @dev The enforcer owns the validation logic; terms are opaque bytes decoded by that enforcer.
struct Caveat {
    address enforcer;
    bytes terms;
}

/// @notice A local execution payload shape for later 1Shot / delegation integration.
/// @dev ERC20 transfers use the token contract as target; the recipient lives inside calldata.
struct Execution {
    address target;
    uint256 value;
    bytes data;
}

