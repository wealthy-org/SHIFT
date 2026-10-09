// Hand-maintained ABI fragments. Every signature here is checked against the
// Solidity sources by scripts/abi-check.mts, so a drift fails loudly.
const u = (name: string, type = "uint256", indexed?: boolean) => (indexed === undefined ? { name, type } : { name, type, indexed });
const err = (name: string, ...inputs: { name: string; type: string }[]) => ({ type: "error", name, inputs }) as const;

const ACCESS_ERRORS = [err("AccessControlUnauthorizedAccount", u("account", "address"), u("neededRole", "bytes32")), err("EnforcedPause")] as const;

export const EMPLOYEE_REGISTRY_ABI = [
  { type: "function", name: "createEmployee", inputs: [u("wallet", "address"), u("metadataHash", "bytes32"), u("uri", "string")], outputs: [u("employeeId")], stateMutability: "nonpayable" },
  { type: "function", name: "linkToken", inputs: [u("employeeId"), u("token", "address"), u("ponsMarket", "address")], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "employeeIdOf", inputs: [u("wallet", "address")], outputs: [u("")], stateMutability: "view" },
  { type: "function", name: "hasLaunched", inputs: [u("employeeId")], outputs: [u("", "bool")], stateMutability: "view" },
  { type: "event", name: "EmployeeCreated", inputs: [u("employeeId", "uint256", true), u("wallet", "address", true), u("metadataHash", "bytes32", false), u("metadataURI", "string", false)] },
  { type: "event", name: "EmployeeTokenLinked", inputs: [u("employeeId", "uint256", true), u("token", "address", true), u("ponsMarket", "address", false)] },
  err("AlreadyEmployed", u("wallet", "address"), u("employeeId")),
  err("UnknownEmployee", u("employeeId")),
  err("TokenAlreadyLinked", u("employeeId")),
  err("ZeroAddress"),
  err("EmptyMetadata"),
  ...ACCESS_ERRORS,
] as const;

export const SHIFT_MANAGER_ABI = [
  { type: "function", name: "startShift", inputs: [u("employeeId")], outputs: [u("shiftId")], stateMutability: "nonpayable" },
  { type: "function", name: "finalizeShift", inputs: [u("shiftId"), u("scoreX10", "uint16"), u("resultHash", "bytes32")], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "invalidateShift", inputs: [u("shiftId"), u("reasonCode", "bytes32"), u("reason", "string")], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "verifyResult", inputs: [u("shiftId"), u("resultHash", "bytes32")], outputs: [u("", "bool")], stateMutability: "view" },
  { type: "function", name: "activeShiftOf", inputs: [u("employeeId")], outputs: [u("")], stateMutability: "view" },
  { type: "event", name: "ShiftStarted", inputs: [u("shiftId", "uint256", true), u("employeeId", "uint256", true), u("startTime", "uint64", false), u("startBlock", "uint64", false)] },
  { type: "event", name: "ShiftFinalized", inputs: [u("shiftId", "uint256", true), u("employeeId", "uint256", true), u("scoreX10", "uint16", false), u("rank", "uint8", false), u("resultHash", "bytes32", false)] },
  { type: "event", name: "ShiftInvalidated", inputs: [u("shiftId", "uint256", true), u("employeeId", "uint256", true), u("reasonCode", "bytes32", false), u("reason", "string", false)] },
  err("UnknownShift", u("shiftId")),
  err("UnknownEmployee", u("employeeId")),
  err("NoConfirmedLaunch", u("employeeId")),
  err("ShiftAlreadyActive", u("employeeId"), u("shiftId")),
  err("ShiftNotActive", u("shiftId"), u("status", "uint8")),
  err("ShiftTooShort", u("shiftId"), u("elapsed", "uint64"), u("required", "uint64")),
  err("CooldownActive", u("employeeId"), u("readyAt", "uint64")),
  err("EmptyResultHash"),
  err("EmptyReason"),
  ...ACCESS_ERRORS,
] as const;

export const PAYROLL_VAULT_ABI = [
  { type: "function", name: "fund", inputs: [u("source", "string")], outputs: [], stateMutability: "payable" },
  { type: "function", name: "unallocated", inputs: [], outputs: [u("")], stateMutability: "view" },
  { type: "function", name: "payrollBps", inputs: [], outputs: [u("", "uint16")], stateMutability: "view" },
  { type: "event", name: "Funded", inputs: [u("from", "address", true), u("amount", "uint256", false), u("toPayroll", "uint256", false), u("toTreasury", "uint256", false), u("source", "string", false)] },
  err("ZeroAmount"),
  err("InsufficientUnallocated", u("requested"), u("available")),
] as const;

export const PAYROLL_DISTRIBUTOR_ABI = [
  { type: "function", name: "finalizeEpoch", inputs: [u("epochId"), u("merkleRoot", "bytes32"), u("pool")], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claim", inputs: [u("epochId"), u("employeeId"), u("wallet", "address"), u("amount"), u("proof", "bytes32[]")], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claimed", inputs: [u("epochId"), u("employeeId")], outputs: [u("", "bool")], stateMutability: "view" },
  { type: "function", name: "claimDelay", inputs: [], outputs: [u("", "uint64")], stateMutability: "view" },
  {
    type: "function",
    name: "getEpoch",
    inputs: [u("epochId")],
    outputs: [{ name: "", type: "tuple", components: [u("merkleRoot", "bytes32"), u("pool"), u("claimed"), u("finalizedAt", "uint64"), u("claimsOpenAt", "uint64")] }],
    stateMutability: "view",
  },
  { type: "event", name: "PayrollEpochFinalized", inputs: [u("epochId", "uint256", true), u("payrollPool", "uint256", false), u("merkleRoot", "bytes32", false), u("claimsOpenAt", "uint64", false)] },
  { type: "event", name: "PayrollClaimed", inputs: [u("epochId", "uint256", true), u("employeeId", "uint256", true), u("wallet", "address", true), u("amount", "uint256", false)] },
  err("EpochAlreadyFinalized", u("epochId")),
  err("EpochNotFinalized", u("epochId")),
  err("ClaimsNotOpen", u("epochId"), u("opensAt", "uint64")),
  err("AlreadyClaimed", u("epochId"), u("employeeId")),
  err("InvalidProof", u("epochId"), u("employeeId")),
  err("ExceedsPool", u("epochId"), u("requested"), u("remaining")),
  err("EmptyRoot"),
  err("ZeroAmount"),
  err("ZeroAddress"),
  err("TransferFailed", u("to", "address"), u("amount")),
  err("InsufficientUnallocated", u("requested"), u("available")),
  err("NotDistributor", u("caller", "address")),
  ...ACCESS_ERRORS,
] as const;

export const PONS_ADAPTER_ABI = [
  { type: "function", name: "launch", inputs: [u("employeeId"), u("name", "string"), u("symbol", "string")], outputs: [u("token", "address"), u("ponsMarket", "address")], stateMutability: "payable" },
  { type: "event", name: "TokenLaunched", inputs: [u("employeeId", "uint256", true), u("token", "address", true), u("ponsMarket", "address", false)] },
] as const;
