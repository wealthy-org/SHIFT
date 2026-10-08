export type ShiftStatus = "PENDING" | "ACTIVE" | "FINALIZING" | "COMPLETED" | "INVALID";
export type Profile = "normal" | "high" | "low" | "pumpdump" | "wash" | "liqmanip";

export interface Trade {
  id: string;
  t: number; // shift elapsed seconds
  wallet: string;
  side: "buy" | "sell";
  eth: number;
  ok: boolean;
}
export interface LiqEvent {
  t: number;
  kind: "add" | "remove";
  eth: number;
  wallet: string;
}
export interface Market {
  token: string;
  market: string;
  profile: Profile;
  rng: { s: number };
  reserveEth: number;
  reserveTok: number;
  k: number;
  holders: Record<string, number>;
  traders: string[];
  fundedBy: Record<string, string>;
  nextOrganic: number;
  trades: Trade[];
  liq: LiqEvent[];
  feesEth: number;
  seq: number;
  // per-second accumulators for the current shift
  secMcap: number[];
  secLiq: number[];
}

export interface Snapshot {
  n: number;
  t: number;
  ts: number;
  block: number;
  mcapTwa: number;
  mcapMin: number;
  mcapMax: number;
  mcapEnd: number;
  volume: number;
  uniqueTraders: number;
  holders: number;
  liquidity: number;
  liquidityMin: number;
  trades: number;
  liveScore: number;
}

export interface Flag {
  code: string;
  severity: "low" | "high";
  detail: string;
  wallets: string[];
  excludedVolume: number;
}

export interface Shift {
  shiftId: number;
  code: string;
  employeeId: number;
  tokenAddress: string;
  startedAt: number;
  endedAt?: number;
  finalizedAt?: number;
  status: ShiftStatus;
  startBlock: number;
  endBlock?: number;
  snapshots: Snapshot[];
  missing: number;
  averageMarketCap: number;
  volume: number;
  rawVolume: number;
  uniqueTraders: number;
  holderCount: number;
  liquidity: number;
  performanceScore: number;
  components?: Record<string, number>;
  finalRank: number;
  prevRank: number;
  promoted: boolean;
  flags: Flag[];
  invalidReason?: string;
  resultPackage?: any;
  resultHash?: string;
  epochId?: number;
  payrollAmount: number; // gwei, set when the epoch is finalized
}

export interface Employee {
  employeeId: number;
  code: string;
  wallet: string;
  displayName: string;
  ticker: string;
  avatar: [string, string];
  avatarURI: string;
  department: string;
  badge: string;
  tokenAddress?: string;
  ponsMarketAddress?: string;
  joinedAt: number;
  currentRank: number;
  totalShifts: number;
  totalPayrollEarned: number; // gwei finalized
  bestPerformanceScore: number;
  launchStatus: "NONE" | "LAUNCHING" | "LIVE" | "REVERTED";
  bot: boolean;
  testLabel?: string;
  profile: Profile;
  shiftIds: number[];
  activeShiftId?: number;
  lastShiftEndedAt?: number;
  nextShiftAt?: number;
  promotedUntil?: number;
  rankHistory: { shiftId: number; from: number; to: number; score: number; ts: number; tx: string }[];
}

export interface Leaf {
  employeeId: number;
  wallet: string;
  shares: number;
  amount: number; // gwei
  claimedAt?: number;
  claimTx?: string;
}
export interface Epoch {
  epochId: number;
  startTime: number;
  endTime: number;
  status: "OPEN" | "FINALIZED";
  grossRevenue: number; // gwei: creator fees + testnet grant + carry
  feeRevenue: number;
  carryIn: number;
  payrollPool: number;
  treasuryAmount: number;
  merkleRoot?: string;
  finalizedAt?: number;
  claimsOpenAt?: number;
  totalShares: number;
  leaves: Leaf[];
  shiftIds: number[];
  fundTx?: string;
  finalizeTx?: string;
}

export interface ChainEvent {
  id: number;
  type: string;
  contract: string;
  who: string;
  employeeId?: number;
  epochId?: number;
  shiftId?: number;
  block: number;
  ts: number;
  tx: string;
  payload?: any;
}

export interface Launch {
  employeeId: number;
  startedAt: number;
  willRevert: boolean;
  step: number; // 0..4
  confirmations: number;
  done: boolean;
  reverted: boolean;
  error?: string;
}

export interface State {
  v: 1;
  t0: number;
  lastStep: number;
  rng: { s: number };
  nextEmployeeId: number;
  nextShiftId: number;
  nextEventId: number;
  employees: Record<number, Employee>;
  byWallet: Record<string, number>;
  tickers: Record<string, number>;
  markets: Record<string, Market>;
  shifts: Record<number, Shift>;
  epochs: Record<number, Epoch>;
  events: ChainEvent[];
  launches: Record<number, Launch>;
  vault: { funded: number; claimed: number; carry: number };
  treasury: number;
  toggles: { rpcDown: boolean; failNextLaunch: boolean };
  log: { ts: number; msg: string }[];
}
