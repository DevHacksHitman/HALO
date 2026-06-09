// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Execution} from "../src/HaloTypes.sol";
import {HaloTreasurer} from "../src/HaloTreasurer.sol";
import {HaloVerifier} from "../src/HaloVerifier.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

contract HaloSubAgentsTest {
    address private constant USDC = address(0x1111);
    address private constant VENICE_PAYMASTER = address(0x2222);
    address private constant REQUESTER = address(0x3333);

    HaloVerifier private verifier;
    HaloTreasurer private treasurer;

    function setUp() public {
        verifier = new HaloVerifier();
        treasurer = new HaloTreasurer();
    }

    function testVerifierBuildsX402PaymentPayload() public view {
        uint256 feeAmount = 2e6;

        Execution memory execution = verifier.constructX402Payment(USDC, VENICE_PAYMASTER, feeAmount);

        _assertTransferExecution(execution, VENICE_PAYMASTER, feeAmount);
    }

    function testTreasurerBuildsGrantPayoutPayload() public view {
        uint256 grantAmount = 25e6;

        Execution memory execution = treasurer.constructGrantPayout(USDC, REQUESTER, grantAmount);

        _assertTransferExecution(execution, REQUESTER, grantAmount);
    }

    function testVerifierRejectsZeroToken() public view {
        _expectVerifierRevert(address(0), VENICE_PAYMASTER, 1);
    }

    function testVerifierRejectsZeroPaymaster() public view {
        _expectVerifierRevert(USDC, address(0), 1);
    }

    function testVerifierRejectsZeroFeeAmount() public view {
        _expectVerifierRevert(USDC, VENICE_PAYMASTER, 0);
    }

    function testTreasurerRejectsZeroToken() public view {
        _expectTreasurerRevert(address(0), REQUESTER, 1);
    }

    function testTreasurerRejectsZeroRequester() public view {
        _expectTreasurerRevert(USDC, address(0), 1);
    }

    function testTreasurerRejectsZeroGrantAmount() public view {
        _expectTreasurerRevert(USDC, REQUESTER, 0);
    }

    function callVerifier(address usdcToken, address venicePaymaster, uint256 feeAmount)
        external
        view
        returns (Execution memory)
    {
        return verifier.constructX402Payment(usdcToken, venicePaymaster, feeAmount);
    }

    function callTreasurer(address usdcToken, address requester, uint256 amount)
        external
        view
        returns (Execution memory)
    {
        return treasurer.constructGrantPayout(usdcToken, requester, amount);
    }

    function _expectVerifierRevert(address usdcToken, address venicePaymaster, uint256 feeAmount) private view {
        bool reverted;

        try this.callVerifier(usdcToken, venicePaymaster, feeAmount) returns (Execution memory) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "expected verifier revert");
    }

    function _expectTreasurerRevert(address usdcToken, address requester, uint256 amount) private view {
        bool reverted;

        try this.callTreasurer(usdcToken, requester, amount) returns (Execution memory) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "expected treasurer revert");
    }

    function _assertTransferExecution(Execution memory execution, address recipient, uint256 amount) private pure {
        require(execution.target == USDC, "target must be USDC");
        require(execution.value == 0, "value must be zero");
        require(_selector(execution.data) == IERC20.transfer.selector, "wrong transfer selector");

        bytes memory expectedData = abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount);
        require(keccak256(execution.data) == keccak256(expectedData), "wrong transfer calldata");
    }

    function _selector(bytes memory data) private pure returns (bytes4 selector) {
        require(data.length >= 4, "data too short");

        assembly {
            selector := mload(add(data, 32))
        }
    }
}

