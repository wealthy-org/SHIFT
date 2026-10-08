// All tunables live here. Rank thresholds, weights and payroll split are
// placeholders per the brief and must be tuned with testnet simulations.
export const CONFIG = {
  speed: Math.max(1, Number(process.env.SHIFT_SPEED || 1)),

  shiftSeconds: 300,
  snapshotSeconds: 20,
  expectedSnapshots: 15,
  maxMissingSnapshots: 2,
  finalizeTailSeconds: 12,
  userCooldownSeconds: 20,
  botCooldownSeconds: [60, 150] as [number, number],

  weights: { marketCap: 0.4, volume: 0.25, participants: 0.15, liquidity: 0.1, stability: 0.1 },
  // reference values where a component saturates at 100 (log scale)
  refs: { marketCap: 300, volume: 150, participants: 250, liquidity: 25 },
  invalidExcludedShare: 0.6,

  ranks: [
    ["Intern", 0],
    ["Analyst", 15],
    ["Associate", 30],
    ["Manager", 45],
    ["VP", 60],
    ["Director", 75],
    ["C-Suite", 88],
    ["CEO", 96],
  ] as [string, number][],
  rankPayMultiplier: [1, 1.1, 1.25, 1.5, 1.8, 2.2, 2.8, 3.5],

  epochSeconds: 300,
  epochFinalizeDelaySeconds: 15,
  claimDelaySeconds: 10,
  payrollPct: 70,
  treasuryPct: 30,
  // Testnet only: the Pons creator-fee model is unverified, so the vault is
  // also topped up by a faucet grant each epoch.
  epochGrantEth: 1.5,
  tradeFeeBps: 100,
  creatorFeeSharePct: 50,

  confirmDepth: 3,
  blocksPerSecond: 4,
  genesisBlock: 4_812_000,

  warmupSeconds: 2 * 3600,
  botCount: 12,
  keepSnapshotsForShifts: 150,
};

export const RANK_NAMES = CONFIG.ranks.map((r) => r[0]);
export const rankIndex = (score: number) => {
  let r = 0;
  CONFIG.ranks.forEach(([, min], i) => {
    if (score >= min) r = i;
  });
  return r;
};
