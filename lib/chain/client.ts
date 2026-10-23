import { createPublicClient, createWalletClient, http, custom, type PublicClient, type WalletClient } from "viem";
import { deployments } from "./deployments";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);

export const ACTIVE_CHAIN = {
  id: chainId,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || "",
  nativeCurrency: { name: "Ether", symbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || ""] },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "",
    },
  },
} as const;

// Backward compatibility alias
export const ROBINHOOD_TESTNET = ACTIVE_CHAIN;

export const CONTRACT_ADDRESSES = {
  employeeRegistry: (process.env.EMPLOYEE_REGISTRY || deployments.contracts.EmployeeRegistry) as `0x${string}`,
  rankManager: (process.env.RANK_MANAGER || deployments.contracts.RankManager) as `0x${string}`,
  shiftManager: (process.env.SHIFT_MANAGER || deployments.contracts.ShiftManager) as `0x${string}`,
  payrollVault: (process.env.PAYROLL_VAULT || deployments.contracts.PayrollVault) as `0x${string}`,
  payrollDistributor: (process.env.PAYROLL_DISTRIBUTOR || deployments.contracts.PayrollDistributor) as `0x${string}`,
  ponsAdapter: (process.env.PONS_ADAPTER || deployments.contracts.PonsAdapter) as `0x${string}`,
};

export function getPublicClient() {
  // undefined (not "") so viem doesn't throw synchronously on a missing RPC URL — see the
  // matching note in lib/chain/signer.ts for why that matters at build/import time.
  return createPublicClient({
    chain: ROBINHOOD_TESTNET,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
  });
}

export function getBrowserWalletClient() {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  return createWalletClient({
    chain: ROBINHOOD_TESTNET,
    transport: custom((window as any).ethereum),
  });
}
