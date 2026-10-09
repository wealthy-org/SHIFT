import { getPublicClient, CONTRACT_ADDRESSES } from "./client";
import { EMPLOYEE_REGISTRY_ABI, SHIFT_MANAGER_ABI, PAYROLL_DISTRIBUTOR_ABI, PONS_ADAPTER_ABI } from "./abi";

export interface OnchainEventLog {
  eventName: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  args: Record<string, any>;
}

export class TestnetEventIndexer {
  private lastCursor: bigint = 0n;
  private client = getPublicClient();

  constructor(initialBlock?: bigint) {
    if (initialBlock) this.lastCursor = initialBlock;
  }

  async syncToHead(): Promise<OnchainEventLog[]> {
    const head = await this.client.getBlockNumber();
    if (this.lastCursor === 0n) {
      // Start 50 blocks behind head or at deployment block
      this.lastCursor = head > 50n ? head - 50n : 0n;
    }

    if (head < this.lastCursor) return [];

    const fromBlock = this.lastCursor + 1n;
    const toBlock = head;

    const events: OnchainEventLog[] = [];

    try {
      // 1. Shift Manager events
      const shiftEvents = await this.client.getLogs({
        address: CONTRACT_ADDRESSES.shiftManager,
        fromBlock,
        toBlock,
      });
      for (const log of shiftEvents) {
        events.push({
          eventName: "ShiftManagerEvent",
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          args: log as any,
        });
      }

      // 2. Payroll Distributor events
      const payrollEvents = await this.client.getLogs({
        address: CONTRACT_ADDRESSES.payrollDistributor,
        fromBlock,
        toBlock,
      });
      for (const log of payrollEvents) {
        events.push({
          eventName: "PayrollDistributorEvent",
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          args: log as any,
        });
      }

      this.lastCursor = toBlock;
    } catch (err) {
      console.error("[Indexer] Sync error:", err);
    }

    return events;
  }

  getCurrentCursor(): bigint {
    return this.lastCursor;
  }
}
