import { parseEventLogs } from "viem";
import { EMPLOYEE_REGISTRY_ABI, PAYROLL_DISTRIBUTOR_ABI, PAYROLL_VAULT_ABI, SHIFT_MANAGER_ABI } from "./abi";
import { CONTRACT_ADDRESSES, getPublicClient } from "./client";

export interface OnchainEventLog {
  eventName: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  args: Record<string, unknown>;
}

const SOURCES = [
  { address: CONTRACT_ADDRESSES.employeeRegistry, abi: EMPLOYEE_REGISTRY_ABI },
  { address: CONTRACT_ADDRESSES.shiftManager, abi: SHIFT_MANAGER_ABI },
  { address: CONTRACT_ADDRESSES.payrollVault, abi: PAYROLL_VAULT_ABI },
  { address: CONTRACT_ADDRESSES.payrollDistributor, abi: PAYROLL_DISTRIBUTOR_ABI },
] as const;

/** Read-only decoder of SHIFT contract events. Used to audit the ledger against the chain. */
export class TestnetEventIndexer {
  private lastCursor: bigint;
  private client = getPublicClient();

  constructor(initialBlock?: bigint) {
    this.lastCursor = initialBlock ?? 0n;
  }

  async syncToHead(maxRange = 5000n): Promise<OnchainEventLog[]> {
    const head = await this.client.getBlockNumber();
    if (this.lastCursor === 0n) this.lastCursor = head > 50n ? head - 50n : 0n;
    if (head <= this.lastCursor) return [];
    const fromBlock = this.lastCursor + 1n;
    const toBlock = head - fromBlock > maxRange ? fromBlock + maxRange : head;
    const out: OnchainEventLog[] = [];
    for (const src of SOURCES) {
      const logs = await this.client.getLogs({ address: src.address, fromBlock, toBlock });
      for (const l of parseEventLogs({ abi: src.abi as any, logs, strict: false }) as any[]) {
        out.push({ eventName: l.eventName, blockNumber: l.blockNumber, transactionHash: l.transactionHash, args: l.args ?? {} });
      }
    }
    this.lastCursor = toBlock;
    return out.sort((a, b) => Number(a.blockNumber - b.blockNumber));
  }

  getCurrentCursor(): bigint {
    return this.lastCursor;
  }
}
