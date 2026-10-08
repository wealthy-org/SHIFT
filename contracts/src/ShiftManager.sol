// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EmployeeRegistry} from "./EmployeeRegistry.sol";
import {RankManager} from "./RankManager.sol";
import {Roles} from "./Roles.sol";

/// @title ShiftManager
/// @notice Opens and closes shifts, and anchors each finalised result onchain.
/// @dev Only the result hash is stored. The full snapshot trail stays offchain,
///      and anyone can recompute its hash and compare it with `resultHash` here.
///      A finalised score can never be changed quietly: `correctShift` is a
///      separate entry point that keeps the original values in its event.
contract ShiftManager is AccessControl, Pausable {
    enum Status {
        NONE,
        ACTIVE,
        COMPLETED,
        INVALID
    }

    struct Shift {
        uint256 employeeId;
        uint64 startedAt;
        uint64 endedAt;
        uint64 startBlock;
        uint64 endBlock;
        bytes32 resultHash;
        uint16 scoreX10;
        uint8 rank;
        Status status;
        bool corrected;
    }

    EmployeeRegistry public immutable registry;
    RankManager public rankManager;

    /// @dev A shift may not be finalised before this much time has passed.
    uint64 public shiftDuration;
    /// @dev Minimum gap between one shift ending and the next starting.
    uint64 public cooldown;

    uint256 public nextShiftId = 1;
    mapping(uint256 shiftId => Shift) private _shifts;
    mapping(uint256 employeeId => uint256 shiftId) public activeShiftOf;
    mapping(uint256 employeeId => uint64 endedAt) public lastShiftEndedAt;

    event ShiftStarted(uint256 indexed shiftId, uint256 indexed employeeId, uint64 startTime, uint64 startBlock);
    event ShiftFinalized(uint256 indexed shiftId, uint256 indexed employeeId, uint16 scoreX10, uint8 rank, bytes32 resultHash);
    event ShiftInvalidated(uint256 indexed shiftId, uint256 indexed employeeId, bytes32 reasonCode, string reason);
    event Promotion(uint256 indexed employeeId, uint8 oldRank, uint8 newRank, uint256 indexed shiftId);
    event RankAssigned(uint256 indexed employeeId, uint256 indexed shiftId, uint8 rank, uint16 scoreX10);
    event ShiftCorrected(
        uint256 indexed shiftId,
        uint16 oldScoreX10,
        uint16 newScoreX10,
        uint8 oldRank,
        uint8 newRank,
        bytes32 oldResultHash,
        bytes32 newResultHash,
        string reason
    );
    event RankManagerUpdated(address indexed oldManager, address indexed newManager);
    event TimingUpdated(uint64 shiftDuration, uint64 cooldown);

    error UnknownShift(uint256 shiftId);
    error UnknownEmployee(uint256 employeeId);
    error NoConfirmedLaunch(uint256 employeeId);
    error ShiftAlreadyActive(uint256 employeeId, uint256 shiftId);
    error ShiftNotActive(uint256 shiftId, Status status);
    error ShiftNotCompleted(uint256 shiftId, Status status);
    error ShiftTooShort(uint256 shiftId, uint64 elapsed, uint64 required);
    error CooldownActive(uint256 employeeId, uint64 readyAt);
    error EmptyResultHash();
    error EmptyReason();
    error ZeroAddress();
    error ZeroDuration();

    constructor(address admin, EmployeeRegistry registry_, RankManager rankManager_, uint64 shiftDuration_, uint64 cooldown_) {
        if (admin == address(0) || address(registry_) == address(0) || address(rankManager_) == address(0)) revert ZeroAddress();
        if (shiftDuration_ == 0) revert ZeroDuration();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        registry = registry_;
        rankManager = rankManager_;
        shiftDuration = shiftDuration_;
        cooldown = cooldown_;
    }

    // --- shifts ---------------------------------------------------------------

    /// @notice Opens a shift. One employee can only have one open at a time, so a
    ///         retrying backend cannot accidentally run two clocks for one person.
    function startShift(uint256 employeeId) external onlyRole(Roles.FINALIZER) whenNotPaused returns (uint256 shiftId) {
        if (!registry.exists(employeeId)) revert UnknownEmployee(employeeId);
        if (!registry.hasLaunched(employeeId)) revert NoConfirmedLaunch(employeeId);

        uint256 active = activeShiftOf[employeeId];
        if (active != 0) revert ShiftAlreadyActive(employeeId, active);

        uint64 last = lastShiftEndedAt[employeeId];
        if (last != 0 && block.timestamp < last + cooldown) revert CooldownActive(employeeId, last + cooldown);

        shiftId = nextShiftId++;
        _shifts[shiftId] = Shift({
            employeeId: employeeId,
            startedAt: uint64(block.timestamp),
            endedAt: 0,
            startBlock: uint64(block.number),
            endBlock: 0,
            resultHash: bytes32(0),
            scoreX10: 0,
            rank: 0,
            status: Status.ACTIVE,
            corrected: false
        });
        activeShiftOf[employeeId] = shiftId;

        emit ShiftStarted(shiftId, employeeId, uint64(block.timestamp), uint64(block.number));
    }

    /// @notice Closes a shift with its score and the hash of its result package.
    /// @param scoreX10 Performance score with one decimal, so 534 means 53.4.
    /// @param resultHash keccak256 of the canonical result package held offchain.
    function finalizeShift(uint256 shiftId, uint16 scoreX10, bytes32 resultHash) external onlyRole(Roles.FINALIZER) {
        Shift storage s = _requireShift(shiftId);
        if (s.status != Status.ACTIVE) revert ShiftNotActive(shiftId, s.status);
        if (resultHash == bytes32(0)) revert EmptyResultHash();

        uint64 elapsed = uint64(block.timestamp) - s.startedAt;
        if (elapsed < shiftDuration) revert ShiftTooShort(shiftId, elapsed, shiftDuration);

        uint8 rank = rankManager.rankFor(scoreX10);

        s.status = Status.COMPLETED;
        s.endedAt = uint64(block.timestamp);
        s.endBlock = uint64(block.number);
        s.scoreX10 = scoreX10;
        s.rank = rank;
        s.resultHash = resultHash;

        uint256 employeeId = s.employeeId;
        _closeOut(employeeId);

        uint8 oldRank = registry.getEmployee(employeeId).currentRank;
        registry.countShift(employeeId);

        emit ShiftFinalized(shiftId, employeeId, scoreX10, rank, resultHash);
        emit RankAssigned(employeeId, shiftId, rank, scoreX10);

        if (rank > oldRank) {
            registry.setRank(employeeId, rank);
            emit Promotion(employeeId, oldRank, rank, shiftId);
        }
    }

    /// @notice Closes a shift without a score because it failed integrity checks.
    /// @dev Excluding a shift is public and reasoned. It is the only sanctioned way
    ///      to discard a result, and it still cannot award one.
    function invalidateShift(uint256 shiftId, bytes32 reasonCode, string calldata reason) external onlyRole(Roles.FINALIZER) {
        Shift storage s = _requireShift(shiftId);
        if (s.status != Status.ACTIVE) revert ShiftNotActive(shiftId, s.status);
        if (bytes(reason).length == 0) revert EmptyReason();

        s.status = Status.INVALID;
        s.endedAt = uint64(block.timestamp);
        s.endBlock = uint64(block.number);

        _closeOut(s.employeeId);
        emit ShiftInvalidated(shiftId, s.employeeId, reasonCode, reason);
    }

    /// @notice Corrects a finalised shift. Deliberately loud: the old values stay in
    ///         the event, the shift is flagged as corrected forever, and it needs an
    ///         admin key rather than the finalisation service key.
    function correctShift(uint256 shiftId, uint16 newScoreX10, bytes32 newResultHash, string calldata reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Shift storage s = _requireShift(shiftId);
        if (s.status != Status.COMPLETED) revert ShiftNotCompleted(shiftId, s.status);
        if (newResultHash == bytes32(0)) revert EmptyResultHash();
        if (bytes(reason).length == 0) revert EmptyReason();

        uint16 oldScore = s.scoreX10;
        uint8 oldRank = s.rank;
        bytes32 oldHash = s.resultHash;
        uint8 newRank = rankManager.rankFor(newScoreX10);

        s.scoreX10 = newScoreX10;
        s.rank = newRank;
        s.resultHash = newResultHash;
        s.corrected = true;

        emit ShiftCorrected(shiftId, oldScore, newScoreX10, oldRank, newRank, oldHash, newResultHash, reason);
    }

    function _closeOut(uint256 employeeId) private {
        delete activeShiftOf[employeeId];
        lastShiftEndedAt[employeeId] = uint64(block.timestamp);
    }

    // --- admin ----------------------------------------------------------------

    function setRankManager(RankManager rankManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(rankManager_) == address(0)) revert ZeroAddress();
        emit RankManagerUpdated(address(rankManager), address(rankManager_));
        rankManager = rankManager_;
    }

    function setTiming(uint64 shiftDuration_, uint64 cooldown_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (shiftDuration_ == 0) revert ZeroDuration();
        shiftDuration = shiftDuration_;
        cooldown = cooldown_;
        emit TimingUpdated(shiftDuration_, cooldown_);
    }

    function pause() external onlyRole(Roles.PAUSER) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- views ----------------------------------------------------------------

    function getShift(uint256 shiftId) external view returns (Shift memory) {
        return _shifts[shiftId];
    }

    /// @notice Confirms a result package matches what was anchored for this shift.
    function verifyResult(uint256 shiftId, bytes32 resultHash) external view returns (bool) {
        Shift storage s = _shifts[shiftId];
        return s.status == Status.COMPLETED && s.resultHash == resultHash;
    }

    function _requireShift(uint256 shiftId) private view returns (Shift storage s) {
        s = _shifts[shiftId];
        if (s.status == Status.NONE) revert UnknownShift(shiftId);
    }
}
