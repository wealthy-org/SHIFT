// Preflight for live mode. Run: npx tsx scripts/chain-check.mts
import { keccak256, stringToHex } from "viem";
import { CONTRACT_ADDRESSES } from "../lib/chain/client";
import { signerService } from "../lib/chain/signer";
import { PAYROLL_VAULT_ABI } from "../lib/chain/abi";

const pub = signerService.publicClient;
const role = (n: string) => keccak256(stringToHex(n));
const ROLES = { FINALIZER: role("shift.role.finalizer"), PAYROLL: role("shift.role.payroll"), REGISTRAR: role("shift.role.registrar") };
const HAS = [{ type: "function", name: "hasRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" }] as const;
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

try {
  const id = await pub.getChainId();
  ok(id === 46630, `RPC reachable, chainId ${id}`);
  console.log("head block", await pub.getBlockNumber());
} catch (e: any) { ok(false, "RPC unreachable: " + (e.shortMessage || e.message)); process.exit(1); }

for (const [k, a] of Object.entries(CONTRACT_ADDRESSES)) {
  const code = await pub.getCode({ address: a });
  ok(!!code && code !== "0x", `${k} has bytecode at ${a}`);
}
const signer = signerService.address;
ok(!!signer, "SIGNER_PRIVATE_KEY is set and valid");
if (signer) {
  const bal = await pub.getBalance({ address: signer });
  ok(bal > 5_000_000_000_000_000n, `signer ${signer} balance ${Number(bal) / 1e18} ETH (needs gas plus the epoch grant)`);
  for (const [r, c] of [["FINALIZER", CONTRACT_ADDRESSES.shiftManager], ["REGISTRAR", CONTRACT_ADDRESSES.employeeRegistry], ["PAYROLL", CONTRACT_ADDRESSES.payrollDistributor]] as const)
    ok((await pub.readContract({ address: c, abi: HAS, functionName: "hasRole", args: [ROLES[r], signer] })) as boolean, `signer holds ${r} on ${c}`);
}
console.log("vault unallocated", await pub.readContract({ address: CONTRACT_ADDRESSES.payrollVault, abi: PAYROLL_VAULT_ABI, functionName: "unallocated" }));
console.log(fail ? `\n${fail} check(s) failed` : "\nchain-check: ready for DATA_MODE=live");
process.exit(fail ? 1 : 0);
