// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Roles} from "./Roles.sol";

/// @title EmployeeRegistry
/// @notice The permanent record of who works at SHIFT: one employee per wallet,
///         an identity that is written once, and the Pons market it launched.
/// @dev Identity is stored as a hash plus a URI. The full document (display name,
///      ticker, avatar, department) lives offchain; the hash makes it tamper-evident.
contract EmployeeRegistry is AccessControl {
    struct Employee {
        address wallet;
        address token;
        address ponsMarket;
        bytes32 metadataHash;
        uint64 joinedAt;
        uint32 totalShifts;
        uint8 currentRank;
        uint8 bestRank;
    }

    /// @dev Ids start at 1 so that 0 reliably means "no employee".
    uint256 public nextEmployeeId = 1;

    mapping(uint256 employeeId => Employee) private _employees;
    mapping(address wallet => uint256 employeeId) public employeeIdOf;
    mapping(uint256 employeeId => string) public metadataURI;

    event EmployeeCreated(uint256 indexed employeeId, address indexed wallet, bytes32 metadataHash, string metadataURI);
    event EmployeeTokenLinked(uint256 indexed employeeId, address indexed token, address ponsMarket);
    event RankUpdated(uint256 indexed employeeId, uint8 oldRank, uint8 newRank);
    event ShiftCounted(uint256 indexed employeeId, uint32 totalShifts);

    error AlreadyEmployed(address wallet, uint256 employeeId);
    error UnknownEmployee(uint256 employeeId);
    error TokenAlreadyLinked(uint256 employeeId);
    error ZeroAddress();
    error EmptyMetadata();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Hires a wallet once and for all. Identity is never regenerated:
    ///         a second call for the same wallet reverts rather than overwriting.
    function createEmployee(address wallet, bytes32 metadataHash, string calldata uri)
        external
        onlyRole(Roles.REGISTRAR)
        returns (uint256 employeeId)
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (metadataHash == bytes32(0)) revert EmptyMetadata();
        uint256 existing = employeeIdOf[wallet];
        if (existing != 0) revert AlreadyEmployed(wallet, existing);

        employeeId = nextEmployeeId++;
        _employees[employeeId] =
            Employee({wallet: wallet, token: address(0), ponsMarket: address(0), metadataHash: metadataHash, joinedAt: uint64(block.timestamp), totalShifts: 0, currentRank: 0, bestRank: 0});
        employeeIdOf[wallet] = employeeId;
        metadataURI[employeeId] = uri;

        emit EmployeeCreated(employeeId, wallet, metadataHash, uri);
    }

    /// @notice Records the token and Pons market an employee launched. Write-once:
    ///         a launched market can never be swapped for another.
    function linkToken(uint256 employeeId, address token, address ponsMarket) external onlyRole(Roles.REGISTRAR) {
        Employee storage e = _requireEmployee(employeeId);
        if (e.token != address(0)) revert TokenAlreadyLinked(employeeId);
        if (token == address(0) || ponsMarket == address(0)) revert ZeroAddress();

        e.token = token;
        e.ponsMarket = ponsMarket;
        emit EmployeeTokenLinked(employeeId, token, ponsMarket);
    }

    /// @notice Sets the rank reached by a finalised shift. Only RankManager holds this role.
    function setRank(uint256 employeeId, uint8 newRank) external onlyRole(Roles.FINALIZER) {
        Employee storage e = _requireEmployee(employeeId);
        uint8 old = e.currentRank;
        e.currentRank = newRank;
        if (newRank > e.bestRank) e.bestRank = newRank;
        emit RankUpdated(employeeId, old, newRank);
    }

    /// @notice Counts a completed shift. Invalid shifts are not counted.
    function countShift(uint256 employeeId) external onlyRole(Roles.FINALIZER) {
        Employee storage e = _requireEmployee(employeeId);
        unchecked {
            e.totalShifts += 1;
        }
        emit ShiftCounted(employeeId, e.totalShifts);
    }

    function getEmployee(uint256 employeeId) external view returns (Employee memory) {
        return _employees[employeeId];
    }

    function walletOf(uint256 employeeId) external view returns (address) {
        return _employees[employeeId].wallet;
    }

    function exists(uint256 employeeId) public view returns (bool) {
        return _employees[employeeId].wallet != address(0);
    }

    function hasLaunched(uint256 employeeId) external view returns (bool) {
        return _employees[employeeId].token != address(0);
    }

    function _requireEmployee(uint256 employeeId) private view returns (Employee storage e) {
        e = _employees[employeeId];
        if (e.wallet == address(0)) revert UnknownEmployee(employeeId);
    }
}
