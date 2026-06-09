// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Caveat} from "../src/HaloTypes.sol";
import {HaloAlmoner} from "../src/HaloAlmoner.sol";

contract HaloAlmonerTest {
    address private constant USDC = address(0x1000);
    address private constant VENICE_PAYMASTER = address(0x2000);
    address private constant VERIFIER_AGENT = address(0x3000);
    address private constant TREASURER_AGENT = address(0x4000);
    address private constant TARGET_ENFORCER = address(0x5000);
    address private constant RECIPIENT_ENFORCER = address(0x6000);
    address private constant SPEND_LIMIT_ENFORCER = address(0x7000);
    address private constant REQUESTER = address(0x8000);
    address private constant ROGUE_AGENT = address(0x9000);

    HaloAlmoner private almoner;

    function setUp() public {
        almoner = _deployDefault();
    }

    function testConstructorRejectsZeroCriticalAddresses() public {
        _expectConstructorRevert(
            address(0),
            VENICE_PAYMASTER,
            VERIFIER_AGENT,
            TREASURER_AGENT,
            TARGET_ENFORCER,
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC, address(0), VERIFIER_AGENT, TREASURER_AGENT, TARGET_ENFORCER, RECIPIENT_ENFORCER, SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC,
            VENICE_PAYMASTER,
            address(0),
            TREASURER_AGENT,
            TARGET_ENFORCER,
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC,
            VENICE_PAYMASTER,
            VERIFIER_AGENT,
            address(0),
            TARGET_ENFORCER,
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC,
            VENICE_PAYMASTER,
            VERIFIER_AGENT,
            TREASURER_AGENT,
            address(0),
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC, VENICE_PAYMASTER, VERIFIER_AGENT, TREASURER_AGENT, TARGET_ENFORCER, address(0), SPEND_LIMIT_ENFORCER
        );
        _expectConstructorRevert(
            USDC, VENICE_PAYMASTER, VERIFIER_AGENT, TREASURER_AGENT, TARGET_ENFORCER, RECIPIENT_ENFORCER, address(0)
        );
    }

    function testConstructorRejectsDuplicateAgents() public {
        _expectConstructorRevert(
            USDC,
            VENICE_PAYMASTER,
            VERIFIER_AGENT,
            VERIFIER_AGENT,
            TARGET_ENFORCER,
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
    }

    function testVerifierCaveatsAreScopedToVeniceAndFeeLimit() public view {
        uint256 amount = 2e6;

        Caveat[] memory caveats = almoner.generateRedelegationCaveats(VERIFIER_AGENT, VENICE_PAYMASTER, amount);

        _assertStandardCaveats(caveats, VENICE_PAYMASTER, amount);
    }

    function testTreasurerCaveatsAreScopedToRequesterAndGrantLimit() public view {
        uint256 amount = 25e6;

        Caveat[] memory caveats = almoner.generateRedelegationCaveats(TREASURER_AGENT, REQUESTER, amount);

        _assertStandardCaveats(caveats, REQUESTER, amount);
    }

    function testRogueAgentCannotRedelegate() public view {
        _expectGenerateRevert(ROGUE_AGENT, REQUESTER, 1e6);
    }

    function testVerifierRejectsNonVeniceRecipient() public view {
        _expectGenerateRevert(VERIFIER_AGENT, REQUESTER, 1e6);
    }

    function testVerifierRejectsFeeAboveCap() public view {
        _expectGenerateRevert(VERIFIER_AGENT, VENICE_PAYMASTER, 2e6 + 1);
    }

    function testTreasurerRejectsGrantAboveCap() public view {
        _expectGenerateRevert(TREASURER_AGENT, REQUESTER, 30e6 + 1);
    }

    function testTreasurerRejectsZeroRecipient() public view {
        _expectGenerateRevert(TREASURER_AGENT, address(0), 1e6);
    }

    function testZeroAmountRejected() public view {
        _expectGenerateRevert(TREASURER_AGENT, REQUESTER, 0);
    }

    function callGenerate(address subAgent, address recipient, uint256 amount) external view returns (Caveat[] memory) {
        return almoner.generateRedelegationCaveats(subAgent, recipient, amount);
    }

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

    function _deployDefault() private returns (HaloAlmoner) {
        return new HaloAlmoner(
            USDC,
            VENICE_PAYMASTER,
            VERIFIER_AGENT,
            TREASURER_AGENT,
            TARGET_ENFORCER,
            RECIPIENT_ENFORCER,
            SPEND_LIMIT_ENFORCER
        );
    }

    function _expectConstructorRevert(
        address usdcToken,
        address venicePaymaster,
        address verifierAgent,
        address treasurerAgent,
        address allowedTargetEnforcer,
        address erc20TransferRecipientEnforcer,
        address erc20SpendLimitEnforcer
    ) private {
        bool reverted;

        try this.deploy(
            usdcToken,
            venicePaymaster,
            verifierAgent,
            treasurerAgent,
            allowedTargetEnforcer,
            erc20TransferRecipientEnforcer,
            erc20SpendLimitEnforcer
        ) returns (
            HaloAlmoner
        ) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "expected constructor revert");
    }

    function _expectGenerateRevert(address subAgent, address recipient, uint256 amount) private view {
        bool reverted;

        try this.callGenerate(subAgent, recipient, amount) returns (Caveat[] memory) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "expected caveat generation revert");
    }

    function _assertStandardCaveats(Caveat[] memory caveats, address recipient, uint256 amount) private pure {
        require(caveats.length == 3, "unexpected caveat count");

        require(caveats[0].enforcer == TARGET_ENFORCER, "wrong target enforcer");
        address targetToken = abi.decode(caveats[0].terms, (address));
        require(targetToken == USDC, "wrong target token");

        require(caveats[1].enforcer == RECIPIENT_ENFORCER, "wrong recipient enforcer");
        (address recipientToken, address decodedRecipient) = abi.decode(caveats[1].terms, (address, address));
        require(recipientToken == USDC, "wrong recipient token");
        require(decodedRecipient == recipient, "wrong recipient");

        require(caveats[2].enforcer == SPEND_LIMIT_ENFORCER, "wrong spend enforcer");
        (address spendToken, uint256 decodedAmount) = abi.decode(caveats[2].terms, (address, uint256));
        require(spendToken == USDC, "wrong spend token");
        require(decodedAmount == amount, "wrong spend amount");
    }
}
