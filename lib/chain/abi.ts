export const EMPLOYEE_REGISTRY_ABI = [
  {
    type: "function",
    name: "createEmployee",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "metadataHash", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "employeeId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "linkToken",
    inputs: [
      { name: "employeeId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "ponsMarket", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "employeeIdOf",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EmployeeCreated",
    inputs: [
      { name: "employeeId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "metadataHash", type: "bytes32", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

export const SHIFT_MANAGER_ABI = [
  {
    type: "function",
    name: "startShift",
    inputs: [{ name: "employeeId", type: "uint256" }],
    outputs: [{ name: "shiftId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalizeShift",
    inputs: [
      { name: "shiftId", type: "uint256" },
      { name: "scoreX10", type: "uint16" },
      { name: "rank", type: "uint8" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ShiftStarted",
    inputs: [
      { name: "shiftId", type: "uint256", indexed: true },
      { name: "employeeId", type: "uint256", indexed: true },
      { name: "startTime", type: "uint64", indexed: false },
      { name: "startBlock", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ShiftFinalized",
    inputs: [
      { name: "shiftId", type: "uint256", indexed: true },
      { name: "employeeId", type: "uint256", indexed: true },
      { name: "scoreX10", type: "uint16", indexed: false },
      { name: "rank", type: "uint8", indexed: false },
      { name: "resultHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const PAYROLL_DISTRIBUTOR_ABI = [
  {
    type: "function",
    name: "finalizeEpoch",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "pool", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "employeeId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimed",
    inputs: [
      { name: "epochId", type: "uint256" },
      { name: "employeeId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PayrollClaimed",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "employeeId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const PONS_ADAPTER_ABI = [
  {
    type: "function",
    name: "launch",
    inputs: [
      { name: "employeeId", type: "uint256" },
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "ponsMarket", type: "address" },
    ],
    stateMutability: "payable",
  },
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "employeeId", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "ponsMarket", type: "address", indexed: false },
    ],
  },
] as const;
