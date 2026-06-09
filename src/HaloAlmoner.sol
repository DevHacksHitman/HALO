// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Caveat} from "./HaloTypes.sol";

/// @title HaloAlmoner
/// @notice Builds tightly scoped caveat bundles for Halo's verifier and treasurer sub-agents.
/// @dev This contract does not custody donor funds. It only describes what a redelegation may do.
contract HaloAlmoner {
    uint256 public constant MAX_VERIFIER_FEE = 2e6; // 2 USDC, assuming a 6-decimal USDC token.
    uint256 public constant MAX_GRANT_AMOUNT = 30e6; // 30 USDC, assuming a 6-decimal USDC token.

    address public immutable usdcToken;
    address public immutable venicePaymaster;
    address public immutable verifierAgent;
    address public immutable treasurerAgent;

    address public immutable allowedTargetEnforcer;
    address public immutable erc20TransferRecipientEnforcer;
    address public immutable erc20SpendLimitEnforcer;

    error ZeroAddress();
    error DuplicateAgent();
    error UnauthorizedAgent(address subAgent);
    error InvalidRecipient(address subAgent, address recipient);
    error ZeroAmount();
    error ExceedsVerifierFeeLimit(uint256 requested, uint256 maximum);
    error ExceedsGrantLimit(uint256 requested, uint256 maximum);

    constructor(
        address _usdcToken,
        address _venicePaymaster,
        address _verifierAgent,
        address _treasurerAgent,
        address _allowedTargetEnforcer,
        address _erc20TransferRecipientEnforcer,
        address _erc20SpendLimitEnforcer
    ) {
        if (
            _usdcToken == address(0) || _venicePaymaster == address(0) || _verifierAgent == address(0)
                || _treasurerAgent == address(0) || _allowedTargetEnforcer == address(0)
                || _erc20TransferRecipientEnforcer == address(0) || _erc20SpendLimitEnforcer == address(0)
        ) {
            revert ZeroAddress();
        }

        if (_verifierAgent == _treasurerAgent) revert DuplicateAgent();

        usdcToken = _usdcToken;
        venicePaymaster = _venicePaymaster;
        verifierAgent = _verifierAgent;
        treasurerAgent = _treasurerAgent;
        allowedTargetEnforcer = _allowedTargetEnforcer;
        erc20TransferRecipientEnforcer = _erc20TransferRecipientEnforcer;
        erc20SpendLimitEnforcer = _erc20SpendLimitEnforcer;
    }

    /// @notice Returns the caveats a backend signer should attach to a sub-agent redelegation.
    /// @dev The transaction target is the USDC contract. Recipient restrictions are separate because
    /// ERC20 recipients are encoded inside transfer calldata, not in the EVM call target field.
    function generateRedelegationCaveats(address subAgent, address recipient, uint256 amount)
        external
        view
        returns (Caveat[] memory caveats)
    {
        if (amount == 0) revert ZeroAmount();

        if (subAgent == verifierAgent) {
            _validateVerifierRedelegation(recipient, amount);
        } else if (subAgent == treasurerAgent) {
            _validateTreasurerRedelegation(recipient, amount);
        } else {
            revert UnauthorizedAgent(subAgent);
        }

        caveats = new Caveat[](3);

        // 1. The EVM call may only target the USDC token contract.
        caveats[0] = Caveat({enforcer: allowedTargetEnforcer, terms: abi.encode(usdcToken)});

        // 2. For ERC20 transfer calldata, the recipient must be the approved payee.
        caveats[1] = Caveat({enforcer: erc20TransferRecipientEnforcer, terms: abi.encode(usdcToken, recipient)});

        // 3. The delegated path may not move more than the scoped USDC amount.
        caveats[2] = Caveat({enforcer: erc20SpendLimitEnforcer, terms: abi.encode(usdcToken, amount)});
    }

    function _validateVerifierRedelegation(address recipient, uint256 amount) private view {
        if (recipient != venicePaymaster) revert InvalidRecipient(verifierAgent, recipient);
        if (amount > MAX_VERIFIER_FEE) revert ExceedsVerifierFeeLimit(amount, MAX_VERIFIER_FEE);
    }

    function _validateTreasurerRedelegation(address recipient, uint256 amount) private pure {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount > MAX_GRANT_AMOUNT) revert ExceedsGrantLimit(amount, MAX_GRANT_AMOUNT);
    }
}
