# SHIFT — testnet build

Clock in. Launch. Perform. Get paid.

An onchain workforce protocol: you sign in with a wallet, SHIFT hires you with a
permanent employee identity, your employee token launches, the market grades a
five-minute shift, and payroll is claimable with a Merkle proof.

This build runs the whole product on a **simulated market and a simulated chain**.
The scoring, ranking, anti-manipulation, payroll and proof logic are real and
deterministic. Prices, trades, blocks and transaction hashes are not.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in what you need, see below
npm run dev                  # http://localhost:3000
```

Open `/clock-in` and connect a browser wallet.

## Environment

Everything is optional except where noted. See `.env.example` for the full list.

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Neon Postgres. Without it, state persists to `.data/state.json`. |
| `AUTH_SECRET` | Signs the session and nonce cookies. **Required in production.** |
| `ADMIN_TOKEN` | Unlocks `/testnet`. Unset means open in dev, closed in production. |
| `NEXT_PUBLIC_CHAIN_ID` | Set it and the wallet is asked to switch networks on sign-in. |
| `NEXT_PUBLIC_RPC_URL` | Lets the wallet *add* the network if it does not know it. |
| `NEXT_PUBLIC_EXPLORER_URL` | Without it, proof links stay disabled — those hashes exist nowhere. |
| `SHIFT_BOTS` | Simulated co-workers, 0–12. `0` gives an office of real employees only. |
| `SHIFT_SPEED` | Clock multiplier. `1` is real time; `10` turns a shift into 30 seconds. |
| `SHIFT_SAVE_SECONDS` | How often state is written to storage. Default 60, minimum 15. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Robinhood Chain testnet

| | |
| --- | --- |
| Chain ID | `46630` |
| RPC | `https://rpc.testnet.chain.robinhood.com` |
| WebSocket | `wss://feed.testnet.chain.robinhood.com` |
| Explorer (Blockscout) | `https://explorer.testnet.chain.robinhood.com` |
| Blockscout API | `https://explorer.testnet.chain.robinhood.com/api/v2` |
| Gas token | ETH |

The public RPC is rate-limited and the docs say not to rely on it in production.

`NEXT_PUBLIC_EXPLORER_URL` is deliberately left empty for now. The ledger is still
simulated, so pointing proof links at the real explorer would send people to
transactions that do not exist. It gets filled in when the contracts land.

## Contracts

Deployed and source-verified on Robinhood Chain testnet (chain 46630):

| Contract | Address |
| --- | --- |
| EmployeeRegistry | `0x6c294e9D6959B6AE5B976BA62689cF75ffdBe811` |
| RankManager | `0x02ED1017509D0758Aa2e8E7374c6dfEb9EcAC00E` |
| ShiftManager | `0x410Fd98Bb78d255d4C0cE0ac2D0CA5e1fD018653` |
| PayrollVault | `0x5E17dDf437F0326c429465883c45E4dBE0bC14d1` |
| PayrollDistributor | `0xa87f8fC594C217aE78F9d1E7Ac361DAB45Fe849E` |
| PonsAdapter (placeholder) | `0xA932f1f371482166A13EeA21F9d38D8D2BFF2970` |

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-git   # libraries are gitignored
forge test                       # 33 tests
forge script script/Deploy.s.sol:Deploy --rpc-url $NEXT_PUBLIC_RPC_URL --broadcast
```

Addresses are written to `contracts/deployments/<chainId>.json`.

Roles are split so the backend can do its job and nothing more. The signer key may
open and finalise shifts and publish payroll roots; it cannot move treasury funds
or rewrite a finalised score. Corrections need the admin key and emit
`ShiftCorrected` with the original values, so a score can never change quietly.
Once an epoch is finalised, its pool is only reachable by a valid Merkle claim —
there is no admin withdrawal at all.

Hashes are keccak256 end to end. `scripts/hash-parity.mts` checks the backend's
leaf hashes, Merkle roots and result hashes against the deployed contracts, so
the two can never drift apart silently.

## Keys

The app never needs anyone's private key. People sign in by signing a message
with their own wallet — no gas, no transaction, no key leaves their browser.

Deploying contracts and writing result hashes does need keys. Use burner keys
generated for this testnet and funded from a faucet, never a personal wallet:

| | |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY` | One-off, deploys the contracts. |
| `SIGNER_PRIVATE_KEY` | Ongoing, writes shift result hashes and Merkle roots. |

Both live in `.env.local`, which is gitignored. Keep it that way, and keep only
faucet funds on these addresses.

## Persistence

State is one document, so it is stored as one gzipped row (`shift_state.state_gz`)
and rewritten on a timer — about 310 KB per write instead of 1.4 MB of raw JSON.
Splitting it into relational tables is worth doing when the indexer replaces the
simulator, since the indexer decides the shape of those tables.

Retention is bounded: raw snapshots for the last `keepSnapshotsForShifts` shifts
and the last `keepEvents` events (`lib/engine/config.ts`). Finalized shifts keep
their result hash either way, so older shifts stay verifiable by hash.

## Sign-in

There is no password and no account. The browser asks the wallet for an address,
the server issues a short-lived nonce, the wallet signs a readable SIWE-shaped
message, and the server verifies the signature before opening a session cookie.
Signing costs no gas and approves no transaction.

Every mutating route reads the wallet from that cookie, never from the request
body, so a caller cannot act for an employee it does not own.

Signing in for the first time also hires you. A wallet always maps to the same
employee: the name, ticker, avatar and employee ID are derived from the address
and stored once. They are never regenerated.

## Ranks

Nobody picks a role. Everyone starts as Intern and the market decides the rest —
a shift's performance score sets the rank, and the rank sets the payroll share.
V1 has no demotion, so ranks only move up.

```
Intern 0 · Analyst 15 · Associate 30 · Manager 45
VP 60 · Director 75 · C-Suite 88 · CEO 96
```

Thresholds, score weights and the payroll split live in `lib/engine/config.ts`.
They are placeholders and need tuning against testnet simulations.

## How a shift is scored

Five minutes, fifteen snapshots, one every twenty seconds. The score is
time-weighted, so a single block's spike cannot carry a shift:

```
40% average market cap · 25% volume · 15% holders and unique traders
10% liquidity · 10% retention and stability
```

Before scoring, the trade trail is cleaned: self-trading, circular flow, wash
volume, sybil clusters, short spikes, liquidity added late and pulled after the
close, failed trades and duplicate indexed events. Each exclusion is recorded as
a flag. A shift with too much excluded volume, or too many missing snapshots, is
marked `INVALID` with a reason rather than quietly edited.

## Payroll

Shifts and payroll epochs are separate, so there is no distribution transaction
every five minutes. At the end of an epoch the pool is split by
`performance × active time`, a Merkle root is published, and each employee claims
against it. Claims verify the proof, and replays and forged amounts are rejected.

## Testnet console

`/testnet` runs the phase 6 checklist: spawn employees with adversarial market
profiles (pump then dump, wash trading, liquidity manipulation), take the RPC
down to drop snapshots, revert the next launch, simulate a reorg, and attempt a
double claim. It also shows live invariants — no epoch pays out more than its
pool, and claims reconcile with the vault.

## Checks

```bash
npx tsc --noEmit                 # types
npx tsx scripts/sim.ts           # 2h simulation: score spread, flags, payroll invariants
npx tsx scripts/e2e-auth.mts     # auth and ownership against a running server
```

`e2e-auth.mts` signs with a real key and expects a server on `BASE`
(default `http://localhost:3090`).

## What is not built yet

- **Smart contracts.** `EmployeeRegistry`, `ShiftManager`, `RankManager`,
  `PayrollVault` and `PayrollDistributor` exist only as backend logic. Nothing is
  written to a chain, and hashes use sha256 where Solidity would use keccak256.
- **Pons integration.** `lib/engine/market.ts` holds a `PonsAdapter` interface
  with a mock behind it. The real adapter needs the deployed contracts, the ABI
  and a verified answer on how creator fees can be claimed and routed — the
  `PONS_INTEGRATION.md` deliverable from phase 1 of the brief.
- **Indexer.** Market data comes from the simulator, not from chain events.
- **Relational schema.** Engine state is persisted as a single compressed row.
  Worth splitting when the indexer replaces the simulator.
