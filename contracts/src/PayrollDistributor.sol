// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PayrollVault} from "./PayrollVault.sol";
import {Roles} from "./Roles.sol";

/// @title PayrollDistributor
/// @notice Pays employees by Merkle claim, one epoch at a time.
/// @dev Shifts run every five minutes but payroll settles per epoch, so there is
///      never an unbounded loop over employees in a payout transaction. Once an
///      epoch is finalised its root and pool are immutable and admin cannot take
///      the money back: payroll stops depending on anyone's discretion.
contract PayrollDistributor is AccessControl, ReentrancyGuard {
    struct Epoch {
        bytes32 merkleRoot;
        uint256 pool;
        uint256 claimed;
        uint64 finalizedAt;
        uint64 claimsOpenAt;
    }

    PayrollVault public immutable vault;

    /// @dev Grace period between finalising an epoch and opening claims, so a
    ///      published root can be checked before anyone draws against it.
    uint64 public claimDelay;

    mapping(uint256 epochId => Epoch) private _epochs;
    mapping(uint256 epochId => mapping(uint256 employeeId => bool)) public claimed;

    event PayrollEpochFinalized(uint256 indexed epochId, uint256 payrollPool, bytes32 merkleRoot, uint64 claimsOpenAt);
    event PayrollClaimed(uint256 indexed epochId, uint256 indexed employeeId, address indexed wallet, uint256 amount);
    event ClaimDelayUpdated(uint64 oldDelay, uint64 newDelay);

    error EpochAlreadyFinalized(uint256 epochId);
    error EpochNotFinalized(uint256 epochId);
    error ClaimsNotOpen(uint256 epochId, uint64 opensAt);
    error AlreadyClaimed(uint256 epochId, uint256 employeeId);
    error InvalidProof(uint256 epochId, uint256 employeeId);
    error ExceedsPool(uint256 epochId, uint256 requested, uint256 remaining);
    error EmptyRoot();
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed(address to, uint256 amount);

    constructor(address admin, PayrollVault vault_, uint64 claimDelay_) {
        if (admin == address(0) || address(vault_) == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        vault = vault_;
        claimDelay = claimDelay_;
    }

    /// @notice Commits an epoch: publishes the root and pulls its pool from the vault
    ///         in the same transaction, so a published root is always fully funded.
    function finalizeEpoch(uint256 epochId, bytes32 merkleRoot, uint256 pool) external onlyRole(Roles.PAYROLL) nonReentrant {
        Epoch storage e = _epochs[epochId];
        if (e.finalizedAt != 0) revert EpochAlreadyFinalized(epochId);
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (pool == 0) revert ZeroAmount();

        uint64 opensAt = uint64(block.timestamp) + claimDelay;
        e.merkleRoot = merkleRoot;
        e.pool = pool;
        e.finalizedAt = uint64(block.timestamp);
        e.claimsOpenAt = opensAt;

        emit PayrollEpochFinalized(epochId, pool, merkleRoot, opensAt);

        vault.releaseToDistributor(epochId, pool);
    }

    /// @notice Claims one employee's pay for an epoch.
    /// @dev Anyone may submit a valid proof. The money goes to the wallet inside the
    ///      leaf, so an automated claim service can pay people without custody.
    function claim(uint256 epochId, uint256 employeeId, address wallet, uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
    {
        Epoch storage e = _epochs[epochId];
        if (e.finalizedAt == 0) revert EpochNotFinalized(epochId);
        if (block.timestamp < e.claimsOpenAt) revert ClaimsNotOpen(epochId, e.claimsOpenAt);
        if (claimed[epochId][employeeId]) revert AlreadyClaimed(epochId, employeeId);
        if (amount == 0) revert ZeroAmount();
        if (wallet == address(0)) revert ZeroAddress();

        bytes32 leaf = leafHash(epochId, employeeId, wallet, amount);
        if (!MerkleProof.verifyCalldata(proof, e.merkleRoot, leaf)) revert InvalidProof(epochId, employeeId);

        uint256 remaining = e.pool - e.claimed;
        if (amount > remaining) revert ExceedsPool(epochId, amount, remaining);

        // Effects before interaction: the claim is recorded before any ETH moves.
        claimed[epochId][employeeId] = true;
        e.claimed += amount;

        emit PayrollClaimed(epochId, employeeId, wallet, amount);

        (bool ok,) = wallet.call{value: amount}("");
        if (!ok) revert TransferFailed(wallet, amount);
    }

    /// @notice The leaf a payroll entry hashes to.
    /// @dev Hashed twice so that no internal node of the tree can be passed off as a
    ///      leaf, which is the standard guard against second-preimage attacks.
    function leafHash(uint256 epochId, uint256 employeeId, address wallet, uint256 amount) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(epochId, employeeId, wallet, amount))));
    }

    function verifyClaim(uint256 epochId, uint256 employeeId, address wallet, uint256 amount, bytes32[] calldata proof)
        external
        view
        returns (bool)
    {
        Epoch storage e = _epochs[epochId];
        if (e.finalizedAt == 0) return false;
        return MerkleProof.verifyCalldata(proof, e.merkleRoot, leafHash(epochId, employeeId, wallet, amount));
    }

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return _epochs[epochId];
    }

    function unclaimed(uint256 epochId) external view returns (uint256) {
        Epoch storage e = _epochs[epochId];
        return e.pool - e.claimed;
    }

    function setClaimDelay(uint64 claimDelay_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit ClaimDelayUpdated(claimDelay, claimDelay_);
        claimDelay = claimDelay_;
    }

    /// @dev Accepts the pool from the vault. There is deliberately no admin
    ///      withdrawal: once an epoch is funded, that ETH is only reachable by claim.
    receive() external payable {}
}
