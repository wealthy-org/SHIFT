// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Roles} from "./Roles.sol";

/// @title PayrollVault
/// @notice Holds the revenue earmarked for employee payroll and splits it between
///         the payroll pool and the treasury by a configurable share.
/// @dev Once funds are released to the distributor for a finalised epoch they are
///      out of reach here. Admin can only move what has not been committed yet.
contract PayrollVault is AccessControl, ReentrancyGuard {
    uint16 public constant BPS = 10_000;

    /// @dev Share of incoming revenue that becomes employee payroll, in basis points.
    uint16 public payrollBps;
    address public treasury;
    address public distributor;

    /// @dev Payroll revenue that has arrived but is not yet committed to an epoch.
    uint256 public unallocated;
    /// @dev Treasury revenue that has arrived but has not been withdrawn.
    uint256 public treasuryBalance;
    /// @dev Lifetime totals, for reconciliation against the offchain ledger.
    uint256 public totalFunded;
    uint256 public totalReleased;

    event Funded(address indexed from, uint256 amount, uint256 toPayroll, uint256 toTreasury, string source);
    event Released(address indexed to, uint256 indexed epochId, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event PayrollSplitUpdated(uint16 oldBps, uint16 newBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DistributorUpdated(address indexed oldDistributor, address indexed newDistributor);

    error ZeroAddress();
    error ZeroAmount();
    error SplitTooHigh(uint16 bps);
    error InsufficientUnallocated(uint256 requested, uint256 available);
    error InsufficientTreasury(uint256 requested, uint256 available);
    error DistributorNotSet();
    error NotDistributor(address caller);
    error TransferFailed(address to, uint256 amount);

    constructor(address admin, address treasury_, uint16 payrollBps_) {
        if (admin == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (payrollBps_ > BPS) revert SplitTooHigh(payrollBps_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        treasury = treasury_;
        payrollBps = payrollBps_;
    }

    /// @notice Pays revenue in and splits it. Anyone may fund; `source` labels where
    ///         it came from (Pons creator fees, a testnet grant, a manual top-up).
    function fund(string calldata source) external payable {
        if (msg.value == 0) revert ZeroAmount();
        uint256 toPayroll = (msg.value * payrollBps) / BPS;
        uint256 toTreasury = msg.value - toPayroll;

        unallocated += toPayroll;
        treasuryBalance += toTreasury;
        totalFunded += msg.value;

        emit Funded(msg.sender, msg.value, toPayroll, toTreasury, source);
    }

    /// @notice Hands an epoch's pool to the distributor. Called by the distributor
    ///         itself while finalising, so funds and the Merkle root commit together.
    function releaseToDistributor(uint256 epochId, uint256 amount) external nonReentrant {
        address d = distributor;
        if (d == address(0)) revert DistributorNotSet();
        if (msg.sender != d) revert NotDistributor(msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (amount > unallocated) revert InsufficientUnallocated(amount, unallocated);

        unallocated -= amount;
        totalReleased += amount;
        emit Released(d, epochId, amount);

        (bool ok,) = d.call{value: amount}("");
        if (!ok) revert TransferFailed(d, amount);
    }

    /// @notice Withdraws the treasury share. It can never touch the payroll side.
    function withdrawTreasury(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > treasuryBalance) revert InsufficientTreasury(amount, treasuryBalance);

        treasuryBalance -= amount;
        address to = treasury;
        emit TreasuryWithdrawn(to, amount);

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed(to, amount);
    }

    // --- admin ----------------------------------------------------------------

    function setDistributor(address distributor_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (distributor_ == address(0)) revert ZeroAddress();
        emit DistributorUpdated(distributor, distributor_);
        distributor = distributor_;
    }

    function setPayrollSplit(uint16 payrollBps_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (payrollBps_ > BPS) revert SplitTooHigh(payrollBps_);
        emit PayrollSplitUpdated(payrollBps, payrollBps_);
        payrollBps = payrollBps_;
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, treasury_);
        treasury = treasury_;
    }

    /// @dev Plain transfers are treated as payroll revenue with no label.
    receive() external payable {
        uint256 toPayroll = (msg.value * payrollBps) / BPS;
        unallocated += toPayroll;
        treasuryBalance += msg.value - toPayroll;
        totalFunded += msg.value;
        emit Funded(msg.sender, msg.value, toPayroll, msg.value - toPayroll, "");
    }
}
