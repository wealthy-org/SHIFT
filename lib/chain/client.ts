import { createPublicClient, createWalletClient, http, custom, type PublicClient, type WalletClient } from "viem";
import deployments from "../../contracts/deployments/46630.json";

export const ROBINHOOD_TESTNET = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.testnet.chain.robinhood.com",
    },
  },
} as const;

export const CONTRACT_ADDRESSES = {
  employeeRegistry: deployments.contracts.EmployeeRegistry as `0x${string}`,
  rankManager: deployments.contracts.RankManager as `0x${string}`,
  shiftManager: deployments.contracts.ShiftManager as `0x${string}`,
  payrollVault: deployments.contracts.PayrollVault as `0x${string}`,
  payrollDistributor: deployments.contracts.PayrollDistributor as `0x${string}`,
  ponsAdapter: deployments.contracts.PonsAdapter as `0x${string}`,
};

export function getPublicClient() {
  return createPublicClient({
    chain: ROBINHOOD_TESTNET,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com"),
  });
}

export function getBrowserWalletClient() {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  return createWalletClient({
    chain: ROBINHOOD_TESTNET,
    transport: custom((window as any).ethereum),
  });
}
