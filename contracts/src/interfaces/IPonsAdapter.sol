// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IPonsAdapter
/// @notice The only surface through which SHIFT touches Pons.
/// @dev Pons is the launch and market layer; SHIFT is the workforce layer. Keeping
///      every Pons-specific call behind this interface means an ABI or contract
///      upgrade on their side is a new adapter, not a rewrite of SHIFT.
interface IPonsAdapter {
    event TokenLaunched(uint256 indexed employeeId, address indexed token, address ponsMarket);
    event CreatorFeesClaimed(address indexed token, uint256 amount, address indexed to);

    /// @notice Launches an employee token on Pons and reports back what was created.
    function launch(uint256 employeeId, string calldata name, string calldata symbol)
        external
        payable
        returns (address token, address ponsMarket);

    /// @notice Market numbers SHIFT reads while scoring a shift.
    function readMarket(address token) external view returns (uint256 marketCap, uint256 liquidity);

    /// @notice Creator fees this adapter can currently claim for a token.
    /// @dev Returns zero when Pons does not expose claimable creator fees. Whether
    ///      these can be routed to PayrollVault is unverified and must be confirmed
    ///      against the deployed Pons contracts before it is relied on.
    function claimableFees(address token) external view returns (uint256);

    /// @notice Claims creator fees and forwards them to `to`.
    function claimFees(address token, address to) external returns (uint256 amount);

    /// @notice What this adapter actually supports, so callers never assume.
    function capabilities() external view returns (bool canLaunch, bool canReadMarket, bool canRouteCreatorFees);
}
