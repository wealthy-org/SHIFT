// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EmployeeRegistry} from "../src/EmployeeRegistry.sol";
import {PayrollDistributor} from "../src/PayrollDistributor.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {ShiftManager} from "../src/ShiftManager.sol";

/// @notice Drives one real loop against a live deployment: hire, start a shift,
///         finalise it with a result hash, fund payroll, publish a root, claim.
/// @dev Run it in two passes because a shift cannot be finalised before its
///      duration has elapsed. `STEP=1` opens, `STEP=2` closes and pays.
contract SmokeTest is Script {
    function run() external {
        uint256 key = vm.envUint("SIGNER_PRIVATE_KEY");
        address me = vm.addr(key);
        uint256 step = vm.envOr("STEP", uint256(1));

        EmployeeRegistry registry = EmployeeRegistry(vm.envAddress("EMPLOYEE_REGISTRY"));
        ShiftManager shifts = ShiftManager(vm.envAddress("SHIFT_MANAGER"));
        PayrollVault vault = PayrollVault(payable(vm.envAddress("PAYROLL_VAULT")));
        PayrollDistributor dist = PayrollDistributor(payable(vm.envAddress("PAYROLL_DISTRIBUTOR")));

        address wallet = vm.envOr("TEST_WALLET", me);

        if (step == 1) {
            vm.startBroadcast(key);
            uint256 employeeId = registry.employeeIdOf(wallet);
            if (employeeId == 0) {
                employeeId = registry.createEmployee(wallet, keccak256(abi.encodePacked("smoke", wallet)), "shift://employee/smoke");
                console.log("hired employeeId", employeeId);
            }
            if (!registry.hasLaunched(employeeId)) {
                registry.linkToken(employeeId, address(uint160(uint256(keccak256("smoke.token")))), address(uint160(uint256(keccak256("smoke.market")))));
                console.log("linked a placeholder token (Pons adapter is not wired yet)");
            }
            uint256 shiftId = shifts.startShift(employeeId);
            console.log("started shiftId", shiftId);
            console.log("wait for the shift duration, then run again with STEP=2 SHIFT_ID=", shiftId);
            vm.stopBroadcast();
            return;
        }

        uint256 sid = vm.envUint("SHIFT_ID");
        uint256 epochId = vm.envOr("EPOCH_ID", uint256(1));
        uint16 scoreX10 = uint16(vm.envOr("SCORE_X10", uint256(534)));
        uint256 pay = vm.envOr("PAY_WEI", uint256(0.0000001 ether));

        vm.startBroadcast(key);

        bytes32 resultHash = keccak256(abi.encodePacked("smoke result package ", vm.toString(sid)));
        shifts.finalizeShift(sid, scoreX10, resultHash);
        ShiftManager.Shift memory s = shifts.getShift(sid);
        console.log("finalised: score", s.scoreX10, "rank", s.rank);
        console.log("anchored hash matches:", shifts.verifyResult(sid, resultHash));

        // One leaf, so the root is the leaf and the proof is empty.
        bytes32 leaf = dist.leafHash(epochId, s.employeeId, wallet, pay);
        vault.fund{value: (pay * 10_000) / 7_000 + 1}("smoke test");
        dist.finalizeEpoch(epochId, leaf, pay);
        console.log("epoch finalised, pool wei", pay);

        vm.stopBroadcast();
        console.log("claims open at", dist.getEpoch(epochId).claimsOpenAt);
        console.log("run STEP=3 after the claim delay to claim");
    }

    /// @notice Claims the single-leaf epoch created by step 2.
    function claim() external {
        uint256 key = vm.envUint("SIGNER_PRIVATE_KEY");
        PayrollDistributor dist = PayrollDistributor(payable(vm.envAddress("PAYROLL_DISTRIBUTOR")));
        EmployeeRegistry registry = EmployeeRegistry(vm.envAddress("EMPLOYEE_REGISTRY"));
        address wallet = vm.envOr("TEST_WALLET", vm.addr(key));
        uint256 epochId = vm.envOr("EPOCH_ID", uint256(1));
        uint256 pay = vm.envOr("PAY_WEI", uint256(0.0000001 ether));
        uint256 employeeId = registry.employeeIdOf(wallet);

        uint256 before = wallet.balance;
        vm.startBroadcast(key);
        dist.claim(epochId, employeeId, wallet, pay, new bytes32[](0));
        vm.stopBroadcast();
        console.log("claimed. balance delta (wei)", wallet.balance - before);
        console.log("marked claimed:", dist.claimed(epochId, employeeId));
    }
}
