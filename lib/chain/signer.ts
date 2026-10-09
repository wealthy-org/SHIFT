import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROBINHOOD_TESTNET, CONTRACT_ADDRESSES } from "./client";
import { SHIFT_MANAGER_ABI, PAYROLL_DISTRIBUTOR_ABI, EMPLOYEE_REGISTRY_ABI } from "./abi";

export class SignerService {
  private signerAccount;
  private walletClient;

  constructor() {
    const key = process.env.SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
    if (key && key.startsWith("0x")) {
      this.signerAccount = privateKeyToAccount(key);
      this.walletClient = createWalletClient({
        account: this.signerAccount,
        chain: ROBINHOOD_TESTNET,
        transport: http(ROBINHOOD_TESTNET.rpcUrls.default.http[0]),
      });
    }
  }

  hasSigner(): boolean {
    return !!this.signerAccount && !!this.walletClient;
  }

  async broadcastStartShift(employeeId: number): Promise<`0x${string}` | null> {
    if (!this.walletClient || !this.signerAccount) return null;
    try {
      const hash = await this.walletClient.writeContract({
        address: CONTRACT_ADDRESSES.shiftManager,
        abi: SHIFT_MANAGER_ABI,
        functionName: "startShift",
        args: [BigInt(employeeId)],
        account: this.signerAccount,
      });
      return hash;
    } catch (e) {
      console.error("[SignerService] Failed to start shift onchain:", e);
      return null;
    }
  }

  async broadcastFinalizeShift(
    shiftId: number,
    score: number,
    rank: number,
    resultHash: `0x${string}`
  ): Promise<`0x${string}` | null> {
    if (!this.walletClient || !this.signerAccount) return null;
    try {
      const scoreX10 = Math.round(score * 10);
      const hash = await this.walletClient.writeContract({
        address: CONTRACT_ADDRESSES.shiftManager,
        abi: SHIFT_MANAGER_ABI,
        functionName: "finalizeShift",
        args: [BigInt(shiftId), scoreX10, rank, resultHash],
        account: this.signerAccount,
      });
      return hash;
    } catch (e) {
      console.error("[SignerService] Failed to finalize shift onchain:", e);
      return null;
    }
  }

  async broadcastFinalizeEpoch(
    epochId: number,
    merkleRoot: `0x${string}`,
    poolWei: bigint
  ): Promise<`0x${string}` | null> {
    if (!this.walletClient || !this.signerAccount) return null;
    try {
      const hash = await this.walletClient.writeContract({
        address: CONTRACT_ADDRESSES.payrollDistributor,
        abi: PAYROLL_DISTRIBUTOR_ABI,
        functionName: "finalizeEpoch",
        args: [BigInt(epochId), merkleRoot, poolWei],
        account: this.signerAccount,
      });
      return hash;
    } catch (e) {
      console.error("[SignerService] Failed to finalize epoch onchain:", e);
      return null;
    }
  }
}

export const signerService = new SignerService();
