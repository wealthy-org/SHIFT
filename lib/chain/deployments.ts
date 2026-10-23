import mainnet from "../../contracts/deployments/4663.json";
import testnet from "../../contracts/deployments/46630.json";

// Picks the deployment record matching NEXT_PUBLIC_CHAIN_ID so contract
// addresses and deployedAtBlock always come from the chain we're actually
// connected to. Falls back to mainnet only when the chain id is unset or
// unrecognized, matching the pre-migration default.
const BY_CHAIN_ID: Record<number, typeof mainnet> = {
  [mainnet.chainId]: mainnet,
  [testnet.chainId]: testnet,
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);
export const deployments = BY_CHAIN_ID[chainId] || mainnet;
