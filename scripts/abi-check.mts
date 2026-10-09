// Fails when lib/chain/abi.ts drifts from the Solidity sources (function, event and error parameter types).
import fs from "node:fs";
import * as A from "../lib/chain/abi.ts";

const MAP: [string, readonly any[]][] = [
  ["EmployeeRegistry", A.EMPLOYEE_REGISTRY_ABI], ["ShiftManager", A.SHIFT_MANAGER_ABI], ["PayrollVault", A.PAYROLL_VAULT_ABI], ["PayrollDistributor", A.PAYROLL_DISTRIBUTOR_ABI],
];
const typeOf = (p: string) => {
  const t = p.trim().split(/\s+/)[0];
  return (t === "uint" ? "uint256" : t).replace(/^Status$/, "uint8");
};
let bad = 0;
for (const [name, abi] of MAP) {
  const all = fs.readdirSync("contracts/src").filter((f) => f.endsWith(".sol")).map((f) => fs.readFileSync(`contracts/src/${f}`, "utf8")).join("\n");
  const src = fs.readFileSync(`contracts/src/${name}.sol`, "utf8");
  for (const f of abi.filter((x) => x.type === "function" || x.type === "event" || x.type === "error")) {
    const types = f.inputs.map((i: any) => i.type).join(",");
    const re = new RegExp(`(?:function|event|error)\\s+${f.name}\\s*\\(([^)]*)\\)`, "g");
    const hits = [...(f.type === "error" ? all : src).matchAll(re)].map((m) => m[1].split(",").map((p) => typeOf(p)).filter((x) => x && x !== "").join(","));
    const pub = new RegExp(`public\\s+(immutable\\s+)?${f.name}\\b`).test(src);
    const inherited = ["AccessControlUnauthorizedAccount", "EnforcedPause"].includes(f.name);
    if (!hits.includes(types) && !pub && !inherited) { console.error(`DRIFT ${name}.${f.name}(${types}) vs [${hits.join(" | ")}]`); bad++; }
  }
}
console.log(bad ? `${bad} drift(s)` : "abi-check: all signatures match the Solidity sources");
process.exit(bad ? 1 : 0);
