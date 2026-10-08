// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EmployeeRegistry} from "../src/EmployeeRegistry.sol";
import {PayrollDistributor} from "../src/PayrollDistributor.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {RankManager} from "../src/RankManager.sol";
import {ShiftManager} from "../src/ShiftManager.sol";
import {Roles} from "../src/Roles.sol";

/// @dev Builds the same sorted-pair Merkle tree the backend builds, so the tests
///      prove the two agree rather than only testing the contract against itself.
library Merkle {
    function hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function root(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        bytes32[] memory layer = leaves;
        while (layer.length > 1) {
            bytes32[] memory next = new bytes32[]((layer.length + 1) / 2);
            for (uint256 i = 0; i < layer.length; i += 2) {
                next[i / 2] = i + 1 < layer.length ? hashPair(layer[i], layer[i + 1]) : layer[i];
            }
            layer = next;
        }
        return layer[0];
    }

    function proof(bytes32[] memory leaves, uint256 index) internal pure returns (bytes32[] memory out) {
        bytes32[] memory tmp = new bytes32[](32);
        uint256 n = 0;
        bytes32[] memory layer = leaves;
        uint256 i = index;
        while (layer.length > 1) {
            uint256 sib = i % 2 == 1 ? i - 1 : i + 1;
            if (sib < layer.length) tmp[n++] = layer[sib];
            bytes32[] memory next = new bytes32[]((layer.length + 1) / 2);
            for (uint256 j = 0; j < layer.length; j += 2) {
                next[j / 2] = j + 1 < layer.length ? hashPair(layer[j], layer[j + 1]) : layer[j];
            }
            layer = next;
            i /= 2;
        }
        out = new bytes32[](n);
        for (uint256 k = 0; k < n; ++k) out[k] = tmp[k];
    }
}

contract ShiftTest is Test {
    EmployeeRegistry registry;
    RankManager ranks;
    ShiftManager shifts;
    PayrollVault vault;
    PayrollDistributor dist;

    address admin = makeAddr("admin");
    address finalizer = makeAddr("finalizer");
    address payroll = makeAddr("payroll");
    address registrar = makeAddr("registrar");
    address pauser = makeAddr("pauser");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");

    uint64 constant SHIFT_DURATION = 300;
    uint64 constant COOLDOWN = 20;
    uint64 constant CLAIM_DELAY = 10;

    function setUp() public {
        uint16[] memory t = new uint16[](8);
        string[] memory n = new string[](8);
        uint16[8] memory tv = [uint16(0), 150, 300, 450, 600, 750, 880, 960];
        string[8] memory nv = ["Intern", "Analyst", "Associate", "Manager", "VP", "Director", "C-Suite", "CEO"];
        for (uint256 i = 0; i < 8; ++i) {
            t[i] = tv[i];
            n[i] = nv[i];
        }

        registry = new EmployeeRegistry(admin);
        ranks = new RankManager(admin, t, n);
        shifts = new ShiftManager(admin, registry, ranks, SHIFT_DURATION, COOLDOWN);
        vault = new PayrollVault(admin, treasury, 7000);
        dist = new PayrollDistributor(admin, vault, CLAIM_DELAY);

        vm.startPrank(admin);
        registry.grantRole(Roles.REGISTRAR, registrar);
        registry.grantRole(Roles.FINALIZER, address(shifts));
        shifts.grantRole(Roles.FINALIZER, finalizer);
        shifts.grantRole(Roles.PAUSER, pauser);
        dist.grantRole(Roles.PAYROLL, payroll);
        vault.setDistributor(address(dist));
        vm.stopPrank();

        vm.warp(1_700_000_000);
    }

    // --- helpers --------------------------------------------------------------

    function _hire(address wallet) internal returns (uint256 id) {
        vm.prank(registrar);
        id = registry.createEmployee(wallet, keccak256(abi.encodePacked("identity", wallet)), "shift://employee/1");
        vm.prank(registrar);
        registry.linkToken(id, address(uint160(uint256(keccak256(abi.encodePacked("token", wallet))))), address(uint160(uint256(keccak256(abi.encodePacked("market", wallet))))));
    }

    function _runShift(uint256 employeeId, uint16 scoreX10) internal returns (uint256 shiftId) {
        vm.prank(finalizer);
        shiftId = shifts.startShift(employeeId);
        vm.warp(block.timestamp + SHIFT_DURATION);
        vm.prank(finalizer);
        shifts.finalizeShift(shiftId, scoreX10, keccak256(abi.encodePacked("result", shiftId)));
    }

    // --- EmployeeRegistry -----------------------------------------------------

    function test_hiresOnceAndKeepsTheIdentity() public {
        uint256 id = _hire(alice);
        assertEq(id, 1);
        assertEq(registry.employeeIdOf(alice), id);
        assertEq(registry.walletOf(id), alice);
        assertTrue(registry.hasLaunched(id));
    }

    function test_revertsOnSecondHireForSameWallet() public {
        uint256 id = _hire(alice);
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(EmployeeRegistry.AlreadyEmployed.selector, alice, id));
        registry.createEmployee(alice, keccak256("other"), "shift://employee/other");
    }

    function test_tokenCannotBeRelinked() public {
        uint256 id = _hire(alice);
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(EmployeeRegistry.TokenAlreadyLinked.selector, id));
        registry.linkToken(id, address(0xdead), address(0xbeef));
    }

    function test_onlyRegistrarCanHire() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.REGISTRAR));
        registry.createEmployee(alice, keccak256("x"), "");
    }

    // --- RankManager ----------------------------------------------------------

    function test_rankBoundariesAreExact() public view {
        assertEq(ranks.rankFor(0), 0);
        assertEq(ranks.rankFor(149), 0);
        assertEq(ranks.rankFor(150), 1);
        assertEq(ranks.rankFor(449), 2);
        assertEq(ranks.rankFor(450), 3);
        assertEq(ranks.rankFor(959), 6);
        assertEq(ranks.rankFor(960), 7);
        assertEq(ranks.rankFor(1000), 7);
    }

    function testFuzz_rankIsMonotonic(uint16 a, uint16 b) public view {
        a = uint16(bound(a, 0, 1000));
        b = uint16(bound(b, 0, 1000));
        if (a > b) (a, b) = (b, a);
        assertLe(ranks.rankFor(a), ranks.rankFor(b));
    }

    function test_rejectsScoreAboveMax() public {
        vm.expectRevert(abi.encodeWithSelector(RankManager.ScoreOutOfRange.selector, uint16(1001)));
        ranks.rankFor(1001);
    }

    function test_rejectsNonAscendingLadder() public {
        uint16[] memory t = new uint16[](3);
        string[] memory n = new string[](3);
        t[0] = 0;
        t[1] = 300;
        t[2] = 200;
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(RankManager.ThresholdsNotAscending.selector, uint256(2)));
        ranks.setLadder(t, n);
    }

    // --- ShiftManager ---------------------------------------------------------

    function test_cannotStartWithoutLaunch() public {
        vm.prank(registrar);
        uint256 id = registry.createEmployee(alice, keccak256("id"), "");
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(ShiftManager.NoConfirmedLaunch.selector, id));
        shifts.startShift(id);
    }

    function test_onlyOneActiveShiftPerEmployee() public {
        uint256 id = _hire(alice);
        vm.prank(finalizer);
        uint256 s1 = shifts.startShift(id);
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(ShiftManager.ShiftAlreadyActive.selector, id, s1));
        shifts.startShift(id);
    }

    function test_cannotFinalizeEarly() public {
        uint256 id = _hire(alice);
        vm.prank(finalizer);
        uint256 s = shifts.startShift(id);
        vm.warp(block.timestamp + SHIFT_DURATION - 1);
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(ShiftManager.ShiftTooShort.selector, s, SHIFT_DURATION - 1, SHIFT_DURATION));
        shifts.finalizeShift(s, 500, keccak256("r"));
    }

    function test_cooldownBetweenShifts() public {
        uint256 id = _hire(alice);
        _runShift(id, 500);
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(ShiftManager.CooldownActive.selector, id, uint64(block.timestamp) + COOLDOWN));
        shifts.startShift(id);

        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(finalizer);
        shifts.startShift(id);
    }

    function test_finalizePromotesAndAnchorsResult() public {
        uint256 id = _hire(alice);
        vm.prank(finalizer);
        uint256 s = shifts.startShift(id);
        vm.warp(block.timestamp + SHIFT_DURATION);

        bytes32 resultHash = keccak256("the result package");
        vm.expectEmit(true, true, false, true);
        emit ShiftManager.Promotion(id, 0, 3, s);
        vm.prank(finalizer);
        shifts.finalizeShift(s, 534, resultHash);

        ShiftManager.Shift memory sh = shifts.getShift(s);
        assertEq(uint8(sh.status), uint8(ShiftManager.Status.COMPLETED));
        assertEq(sh.scoreX10, 534);
        assertEq(sh.rank, 3);
        assertEq(sh.resultHash, resultHash);
        assertTrue(shifts.verifyResult(s, resultHash));
        assertFalse(shifts.verifyResult(s, keccak256("tampered")));
        assertEq(registry.getEmployee(id).currentRank, 3);
        assertEq(registry.getEmployee(id).totalShifts, 1);
    }

    function test_rankNeverDropsOnAWeakerShift() public {
        uint256 id = _hire(alice);
        _runShift(id, 620); // VP
        assertEq(registry.getEmployee(id).currentRank, 4);

        vm.warp(block.timestamp + COOLDOWN);
        _runShift(id, 100); // Intern-level score
        assertEq(registry.getEmployee(id).currentRank, 4, "V1 has no demotion");
        assertEq(registry.getEmployee(id).bestRank, 4);
    }

    function test_invalidShiftScoresNothingAndIsNotCounted() public {
        uint256 id = _hire(alice);
        vm.prank(finalizer);
        uint256 s = shifts.startShift(id);
        vm.prank(finalizer);
        shifts.invalidateShift(s, keccak256("WASH_VOLUME"), "99% of volume excluded as manipulation");

        ShiftManager.Shift memory sh = shifts.getShift(s);
        assertEq(uint8(sh.status), uint8(ShiftManager.Status.INVALID));
        assertEq(sh.scoreX10, 0);
        assertEq(registry.getEmployee(id).totalShifts, 0);
        assertEq(shifts.activeShiftOf(id), 0);
    }

    function test_finalizerCannotSilentlyRewriteAScore() public {
        uint256 id = _hire(alice);
        uint256 s = _runShift(id, 500);

        // The finalisation key cannot touch a closed shift at all.
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(ShiftManager.ShiftNotActive.selector, s, ShiftManager.Status.COMPLETED));
        shifts.finalizeShift(s, 900, keccak256("better"));

        // And it cannot reach the correction path either.
        vm.prank(finalizer);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, finalizer, bytes32(0)));
        shifts.correctShift(s, 900, keccak256("better"), "nope");
    }

    function test_correctionIsLoudAndLeavesATrail() public {
        uint256 id = _hire(alice);
        uint256 s = _runShift(id, 500);
        bytes32 oldHash = shifts.getShift(s).resultHash;

        vm.expectEmit(true, false, false, true);
        emit ShiftManager.ShiftCorrected(s, 500, 620, 3, 4, oldHash, keccak256("recomputed"), "indexer missed two snapshots");
        vm.prank(admin);
        shifts.correctShift(s, 620, keccak256("recomputed"), "indexer missed two snapshots");

        ShiftManager.Shift memory sh = shifts.getShift(s);
        assertTrue(sh.corrected, "correction is permanent on the record");
        assertEq(sh.scoreX10, 620);
    }

    function test_pauseStopsNewShiftsOnly() public {
        uint256 id = _hire(alice);
        vm.prank(finalizer);
        uint256 s = shifts.startShift(id);

        vm.prank(pauser);
        shifts.pause();

        vm.prank(finalizer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        shifts.startShift(id);

        // A shift already running must still be closable while paused.
        vm.warp(block.timestamp + SHIFT_DURATION);
        vm.prank(finalizer);
        shifts.finalizeShift(s, 400, keccak256("r"));
        assertEq(uint8(shifts.getShift(s).status), uint8(ShiftManager.Status.COMPLETED));
    }

    // --- PayrollVault ---------------------------------------------------------

    function test_fundSplitsBetweenPayrollAndTreasury() public {
        vault.fund{value: 10 ether}("pons creator fees");
        assertEq(vault.unallocated(), 7 ether);
        assertEq(vault.treasuryBalance(), 3 ether);
        assertEq(vault.totalFunded(), 10 ether);
    }

    function test_treasuryWithdrawalCannotTouchPayroll() public {
        vault.fund{value: 10 ether}("");
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.InsufficientTreasury.selector, 4 ether, 3 ether));
        vault.withdrawTreasury(4 ether);

        vm.prank(admin);
        vault.withdrawTreasury(3 ether);
        assertEq(treasury.balance, 3 ether);
        assertEq(vault.unallocated(), 7 ether, "payroll untouched");
    }

    function test_onlyDistributorCanPullPayroll() public {
        vault.fund{value: 10 ether}("");
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.NotDistributor.selector, admin));
        vault.releaseToDistributor(1, 1 ether);
    }

    // --- PayrollDistributor ---------------------------------------------------

    function _epochTree(uint256 epochId, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts)
        internal
        view
        returns (bytes32[] memory leaves)
    {
        leaves = new bytes32[](2);
        for (uint256 i = 0; i < 2; ++i) {
            leaves[i] = dist.leafHash(epochId, ids[i], wallets[i], amounts[i]);
        }
        if (leaves[1] < leaves[0]) (leaves[0], leaves[1]) = (leaves[1], leaves[0]);
    }

    function _finalizedEpoch() internal returns (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) {
        _hire(alice);
        _hire(bob);
        ids = [uint256(1), uint256(2)];
        wallets = [alice, bob];
        amounts = [uint256(0.6 ether), uint256(0.4 ether)];

        leaves = new bytes32[](2);
        leaves[0] = dist.leafHash(1, ids[0], wallets[0], amounts[0]);
        leaves[1] = dist.leafHash(1, ids[1], wallets[1], amounts[1]);

        vault.fund{value: 10 ether}("");
        vm.prank(payroll);
        dist.finalizeEpoch(1, Merkle.root(leaves), 1 ether);
        vm.warp(block.timestamp + CLAIM_DELAY);
    }

    function test_claimPaysTheWalletInTheLeaf() public {
        (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) = _finalizedEpoch();

        dist.claim(1, ids[0], wallets[0], amounts[0], Merkle.proof(leaves, 0));
        assertEq(alice.balance, 0.6 ether);
        assertTrue(dist.claimed(1, ids[0]));
        assertEq(dist.unclaimed(1), 0.4 ether);
    }

    function test_doubleClaimIsRejected() public {
        (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) = _finalizedEpoch();
        bytes32[] memory p = Merkle.proof(leaves, 0);

        dist.claim(1, ids[0], wallets[0], amounts[0], p);
        vm.expectRevert(abi.encodeWithSelector(PayrollDistributor.AlreadyClaimed.selector, 1, ids[0]));
        dist.claim(1, ids[0], wallets[0], amounts[0], p);
        assertEq(alice.balance, 0.6 ether, "paid exactly once");
    }

    function test_forgedAmountIsRejected() public {
        (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) = _finalizedEpoch();
        vm.expectRevert(abi.encodeWithSelector(PayrollDistributor.InvalidProof.selector, 1, ids[0]));
        dist.claim(1, ids[0], wallets[0], amounts[0] + 1, Merkle.proof(leaves, 0));
    }

    function test_claimingToAnotherWalletIsRejected() public {
        (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) = _finalizedEpoch();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PayrollDistributor.InvalidProof.selector, 1, ids[0]));
        dist.claim(1, ids[0], stranger, amounts[0], Merkle.proof(leaves, 0));
        assertEq(wallets[0].balance, 0);
    }

    function test_anyoneMaySubmitAValidProofButPayGoesToTheEmployee() public {
        (bytes32[] memory leaves, uint256[2] memory ids, address[2] memory wallets, uint256[2] memory amounts) = _finalizedEpoch();
        vm.prank(stranger);
        dist.claim(1, ids[1], wallets[1], amounts[1], Merkle.proof(leaves, 1));
        assertEq(bob.balance, 0.4 ether);
        assertEq(stranger.balance, 0);
    }

    function test_claimsAreClosedBeforeTheDelayElapses() public {
        _hire(alice);
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = dist.leafHash(2, 1, alice, 1 ether);
        vault.fund{value: 10 ether}("");

        vm.prank(payroll);
        dist.finalizeEpoch(2, Merkle.root(leaves), 1 ether);

        uint64 opensAt = dist.getEpoch(2).claimsOpenAt;
        vm.expectRevert(abi.encodeWithSelector(PayrollDistributor.ClaimsNotOpen.selector, 2, opensAt));
        dist.claim(2, 1, alice, 1 ether, new bytes32[](0));
    }

    function test_epochRootIsImmutable() public {
        _finalizedEpoch();
        vm.prank(payroll);
        vm.expectRevert(abi.encodeWithSelector(PayrollDistributor.EpochAlreadyFinalized.selector, 1));
        dist.finalizeEpoch(1, keccak256("different root"), 1 ether);
    }

    function test_adminCannotTakeBackFinalizedPayroll() public {
        _finalizedEpoch();
        assertEq(address(dist).balance, 1 ether);

        // There is no withdrawal entry point at all: the only call that moves ETH
        // out of the distributor is `claim`, and it needs a valid proof.
        vm.prank(admin);
        (bool ok,) = address(dist).call(abi.encodeWithSignature("withdraw(uint256)", 1 ether));
        assertFalse(ok, "no admin withdrawal exists");
        assertEq(address(dist).balance, 1 ether);
    }

    function test_epochCannotBeFinalizedBeyondAvailableFunds() public {
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = dist.leafHash(3, 1, alice, 1 ether);
        vault.fund{value: 1 ether}(""); // 0.7 ETH to payroll

        vm.prank(payroll);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.InsufficientUnallocated.selector, 1 ether, 0.7 ether));
        dist.finalizeEpoch(3, Merkle.root(leaves), 1 ether);
    }

    function test_onlyPayrollRoleCanFinalize() public {
        vault.fund{value: 10 ether}("");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, Roles.PAYROLL));
        dist.finalizeEpoch(9, keccak256("root"), 1 ether);
    }

    // --- the whole loop -------------------------------------------------------

    function test_fullLoopFromHireToPaid() public {
        uint256 id = _hire(alice);
        uint256 shiftId = _runShift(id, 534);

        ShiftManager.Shift memory sh = shifts.getShift(shiftId);
        assertEq(sh.rank, 3, "Manager");
        assertEq(registry.getEmployee(id).currentRank, 3);

        bytes32[] memory leaves = new bytes32[](1);
        uint256 pay = 0.597 ether;
        leaves[0] = dist.leafHash(1, id, alice, pay);

        vault.fund{value: 1 ether}("pons creator fees");
        vm.prank(payroll);
        dist.finalizeEpoch(1, Merkle.root(leaves), pay);
        vm.warp(block.timestamp + CLAIM_DELAY);

        dist.claim(1, id, alice, pay, Merkle.proof(leaves, 0));

        assertEq(alice.balance, pay);
        assertEq(dist.unclaimed(1), 0);
        assertTrue(shifts.verifyResult(shiftId, sh.resultHash));
        assertEq(vault.totalReleased(), pay);
    }

    /// @dev Many employees in one epoch: the payout is per-claim, so nothing here
    ///      ever loops over the employee set in a single transaction.
    function test_largeEpochPaysOutWithoutUnboundedLoops() public {
        uint256 n = 64;
        bytes32[] memory leaves = new bytes32[](n);
        address[] memory wallets = new address[](n);
        uint256[] memory amounts = new uint256[](n);

        for (uint256 i = 0; i < n; ++i) {
            wallets[i] = address(uint160(0x1000 + i));
            amounts[i] = 0.01 ether;
            leaves[i] = dist.leafHash(5, i + 1, wallets[i], amounts[i]);
        }

        vault.fund{value: 10 ether}("");
        vm.prank(payroll);
        dist.finalizeEpoch(5, Merkle.root(leaves), n * 0.01 ether);
        vm.warp(block.timestamp + CLAIM_DELAY);

        for (uint256 i = 0; i < n; ++i) {
            dist.claim(5, i + 1, wallets[i], amounts[i], Merkle.proof(leaves, i));
            assertEq(wallets[i].balance, 0.01 ether);
        }
        assertEq(dist.unclaimed(5), 0);
        assertEq(address(dist).balance, 0);
    }
}
