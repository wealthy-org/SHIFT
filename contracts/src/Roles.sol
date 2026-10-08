// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Role ids shared across SHIFT contracts.
/// Separation is deliberate: the backend that finalises shifts must never be able
/// to move money, and the address that funds payroll must never be able to score.
library Roles {
    /// Opens and finalises shifts. Held by the shift finalisation service.
    bytes32 internal constant FINALIZER = keccak256("shift.role.finalizer");
    /// Publishes payroll epoch roots. Held by the payroll service.
    bytes32 internal constant PAYROLL = keccak256("shift.role.payroll");
    /// Registers employees and links their Pons market. Held by the API.
    bytes32 internal constant REGISTRAR = keccak256("shift.role.registrar");
    /// Pauses user-facing entry points. Held by an on-call key.
    bytes32 internal constant PAUSER = keccak256("shift.role.pauser");
}
