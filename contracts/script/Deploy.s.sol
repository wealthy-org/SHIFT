// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EmployeeRegistry} from "../src/EmployeeRegistry.sol";
import {PayrollDistributor} from "../src/PayrollDistributor.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {PonsAdapterUnavailable} from "../src/PonsAdapterUnavailable.sol";
import {RankManager} from "../src/RankManager.sol";
import {Roles} from "../src/Roles.sol";
import {ShiftManager} from "../src/ShiftManager.sol";

/// @notice Deploys SHIFT and wires the roles.
/// @dev Role separation is the point of the wiring below: the backend signer may
///      finalise shifts and publish payroll roots, but it can never move treasury
///      funds or rewrite a finalised score. Those stay with the admin key.
contract Deploy is Script {
    uint64 constant SHIFT_DURATION = 300;
    uint64 constant COOLDOWN = 20;
    uint64 constant CLAIM_DELAY = 10;
    uint16 constant PAYROLL_BPS = 7000;

    /// @dev Held as state so the JSON writer does not need a 9-argument call.
    struct Deployment {
        address registry;
        address ranks;
        address shifts;
        address vault;
        address dist;
        address pons;
        address admin;
        address signer;
        address treasury;
    }

    Deployment private d;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address signer = vm.envOr("SIGNER_ADDRESS", deployer);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", admin);

        console.log("deployer", deployer);
        console.log("admin   ", admin);
        console.log("signer  ", signer);
        console.log("treasury", treasury);

        (uint16[] memory thresholds, string[] memory names) = _ladder();

        vm.startBroadcast(deployerKey);

        EmployeeRegistry registry = new EmployeeRegistry(admin);
        RankManager ranks = new RankManager(admin, thresholds, names);
        ShiftManager shifts = new ShiftManager(admin, registry, ranks, SHIFT_DURATION, COOLDOWN);
        PayrollVault vault = new PayrollVault(admin, treasury, PAYROLL_BPS);
        PayrollDistributor dist = new PayrollDistributor(admin, vault, CLAIM_DELAY);
        PonsAdapterUnavailable pons = new PonsAdapterUnavailable();

        // The deployer wires everything, then hands admin over if it is not admin.
        if (deployer == admin) {
            registry.grantRole(Roles.FINALIZER, address(shifts));
            registry.grantRole(Roles.REGISTRAR, signer);
            shifts.grantRole(Roles.FINALIZER, signer);
            shifts.grantRole(Roles.PAUSER, signer);
            dist.grantRole(Roles.PAYROLL, signer);
            vault.setDistributor(address(dist));
        } else {
            console.log("admin differs from deployer: grant roles and setDistributor from the admin key");
        }

        vm.stopBroadcast();

        d = Deployment({
            registry: address(registry),
            ranks: address(ranks),
            shifts: address(shifts),
            vault: address(vault),
            dist: address(dist),
            pons: address(pons),
            admin: admin,
            signer: signer,
            treasury: treasury
        });
        _write();
    }

    function _ladder() private pure returns (uint16[] memory thresholds, string[] memory names) {
        thresholds = new uint16[](8);
        names = new string[](8);
        uint16[8] memory t = [uint16(0), 150, 300, 450, 600, 750, 880, 960];
        string[8] memory n = ["Intern", "Analyst", "Associate", "Manager", "VP", "Director", "C-Suite", "CEO"];
        for (uint256 i = 0; i < 8; ++i) {
            thresholds[i] = t[i];
            names[i] = n[i];
        }
    }

    function _write() private {
        string memory j = "{\n";
        j = string.concat(j, '  "chainId": ', vm.toString(block.chainid), ",\n");
        j = string.concat(j, '  "deployedAtBlock": ', vm.toString(block.number), ",\n");
        j = string.concat(j, '  "admin": "', vm.toString(d.admin), '",\n');
        j = string.concat(j, '  "signer": "', vm.toString(d.signer), '",\n');
        j = string.concat(j, '  "treasury": "', vm.toString(d.treasury), '",\n');
        j = string.concat(j, '  "contracts": {\n');
        j = string.concat(j, '    "EmployeeRegistry": "', vm.toString(d.registry), '",\n');
        j = string.concat(j, '    "RankManager": "', vm.toString(d.ranks), '",\n');
        j = string.concat(j, '    "ShiftManager": "', vm.toString(d.shifts), '",\n');
        j = string.concat(j, '    "PayrollVault": "', vm.toString(d.vault), '",\n');
        j = string.concat(j, '    "PayrollDistributor": "', vm.toString(d.dist), '",\n');
        j = string.concat(j, '    "PonsAdapter": "', vm.toString(d.pons), '"\n  },\n');
        j = string.concat(j, '  "config": {\n');
        j = string.concat(j, '    "shiftDuration": ', vm.toString(uint256(SHIFT_DURATION)), ",\n");
        j = string.concat(j, '    "cooldown": ', vm.toString(uint256(COOLDOWN)), ",\n");
        j = string.concat(j, '    "claimDelay": ', vm.toString(uint256(CLAIM_DELAY)), ",\n");
        j = string.concat(j, '    "payrollBps": ', vm.toString(uint256(PAYROLL_BPS)), "\n  }\n}\n");

        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, j);
        console.log("wrote", path);
    }
}
