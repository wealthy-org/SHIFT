// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RankManager
/// @notice Turns a performance score into a career rank. Thresholds live in storage
///         rather than in code so they can be tuned from testnet simulations.
/// @dev Scores are fixed-point with one decimal: 534 means 53.4.
contract RankManager is AccessControl {
    uint16 public constant MAX_SCORE = 1000;
    uint256 public constant MAX_RANKS = 16;

    /// @dev Minimum score for each rank, ascending. Index is the rank id.
    uint16[] private _thresholds;
    string[] private _names;

    event ThresholdsUpdated(uint16[] thresholds, string[] names);

    error EmptyLadder();
    error LadderTooLong(uint256 length);
    error LengthMismatch(uint256 thresholds, uint256 names);
    error FirstThresholdMustBeZero(uint16 given);
    error ThresholdsNotAscending(uint256 index);
    error ScoreOutOfRange(uint16 score);
    error ZeroAddress();

    constructor(address admin, uint16[] memory thresholds_, string[] memory names_) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _setLadder(thresholds_, names_);
    }

    /// @notice Replaces the ladder. Past shifts keep the rank they were given:
    ///         this only affects shifts finalised after the change.
    function setLadder(uint16[] calldata thresholds_, string[] calldata names_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setLadder(thresholds_, names_);
    }

    function _setLadder(uint16[] memory thresholds_, string[] memory names_) private {
        uint256 n = thresholds_.length;
        if (n == 0) revert EmptyLadder();
        if (n > MAX_RANKS) revert LadderTooLong(n);
        if (n != names_.length) revert LengthMismatch(n, names_.length);
        if (thresholds_[0] != 0) revert FirstThresholdMustBeZero(thresholds_[0]);
        for (uint256 i = 1; i < n; ++i) {
            if (thresholds_[i] <= thresholds_[i - 1]) revert ThresholdsNotAscending(i);
        }
        _thresholds = thresholds_;
        _names = names_;
        emit ThresholdsUpdated(thresholds_, names_);
    }

    /// @notice The rank a score earns. Deterministic and pure: the same score
    ///         always gives the same rank for a given ladder.
    function rankFor(uint16 scoreX10) public view returns (uint8) {
        if (scoreX10 > MAX_SCORE) revert ScoreOutOfRange(scoreX10);
        uint256 n = _thresholds.length;
        uint8 rank = 0;
        for (uint256 i = 1; i < n; ++i) {
            if (scoreX10 >= _thresholds[i]) rank = uint8(i);
            else break;
        }
        return rank;
    }

    function rankName(uint8 rank) external view returns (string memory) {
        return rank < _names.length ? _names[rank] : "";
    }

    function ladder() external view returns (uint16[] memory thresholds_, string[] memory names_) {
        return (_thresholds, _names);
    }

    function rankCount() external view returns (uint256) {
        return _thresholds.length;
    }
}
