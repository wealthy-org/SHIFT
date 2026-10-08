// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IPonsAdapter} from "./interfaces/IPonsAdapter.sol";

/// @title PonsAdapterUnavailable
/// @notice Placeholder adapter used until the deployed Pons contracts are inspected.
/// @dev The brief is explicit that undocumented Pons functions must not be assumed.
///      So this reports no capabilities and reverts rather than guessing an ABI.
///      Replace it with a real adapter once PONS_INTEGRATION.md is written; nothing
///      else in SHIFT has to change.
contract PonsAdapterUnavailable is IPonsAdapter {
    error PonsIntegrationNotVerified();

    function launch(uint256, string calldata, string calldata) external payable returns (address, address) {
        revert PonsIntegrationNotVerified();
    }

    function readMarket(address) external pure returns (uint256, uint256) {
        revert PonsIntegrationNotVerified();
    }

    function claimableFees(address) external pure returns (uint256) {
        return 0;
    }

    function claimFees(address, address) external pure returns (uint256) {
        revert PonsIntegrationNotVerified();
    }

    function capabilities() external pure returns (bool, bool, bool) {
        return (false, false, false);
    }
}
