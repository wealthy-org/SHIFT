# SHIFT

## Developer Brief

### Product

SHIFT is an onchain workforce protocol built for Robinhood Chain.

Core idea:

**Clock in → Launch → Perform → Rank → Get paid**

Users join SHIFT as onchain employees. Each employee receives a
generated identity and launches an employee token through Pons. During
each shift, SHIFT tracks the token's onchain performance. Performance
determines the employee's rank and payroll allocation.

SHIFT should feel like a live company running entirely onchain, not a
generic token launchpad.

### Positioning

**Name:** SHIFT\
**Main Token:** \$SHIFT\
**Tagline:** Clock in. Launch. Perform. Get paid.\
**Category:** Onchain Workforce / Social Launch Protocol\
**Launch Layer:** Pons\
**Network:** Robinhood Chain

### Important Product Principle

Pons is the token launch and market layer.

SHIFT is the workforce, performance, ranking, payroll, and gamification
layer.

Do not rebuild a separate bonding curve or launchpad if Pons already
exposes the required contracts or integration path.

------------------------------------------------------------------------

## 1. Core User Flow

1.  User connects an EVM wallet.
2.  User selects `Clock In`.
3.  SHIFT creates an employee profile.
4.  Employee receives a generated name, ticker, avatar, and employee ID.
5.  User confirms the launch.
6.  Employee token launches through Pons.
7.  SHIFT stores the Pons market/token information.
8.  A 5-minute shift begins.
9.  Backend/indexer takes performance snapshots every 20 seconds.
10. SHIFT calculates the employee's performance score.
11. Employee receives a career rank.
12. Eligible payroll is calculated.
13. Payroll is distributed or made claimable.
14. Shift result and payout proof remain visible publicly.
15. Employee can participate in future shifts according to protocol
    rules.

Target UX:

`Connect Wallet → Clock In → Launch on Pons → Work Shift → Rank → Payday`

------------------------------------------------------------------------

## 2. Employee Generation

Each wallet should have an employee profile.

Suggested fields:

``` ts
Employee {
  employeeId
  wallet
  displayName
  ticker
  avatarURI
  tokenAddress
  ponsMarketAddress
  joinedAt
  currentRank
  totalShifts
  totalPayrollEarned
  bestPerformanceScore
}
```

For V1, SHIFT can generate:

-   Employee display name
-   Employee number
-   Token ticker
-   Avatar
-   Department or role
-   Employee badge

The generated identity should be deterministic or permanently stored
after creation.

Never silently regenerate an employee identity.

------------------------------------------------------------------------

## 3. Pons Launch Integration

Employee tokens must launch through Pons rather than through an internal
SHIFT launchpad.

Build a dedicated integration layer:

``` text
PonsAdapter
```

Responsibilities:

-   Prepare launch parameters
-   Submit or route token creation
-   Detect successful Pons launch
-   Record token address
-   Record market/launch address
-   Read supported market data
-   Read relevant creator-fee information
-   Claim or route fees only where Pons contracts explicitly support it
-   Emit SHIFT-side events linking employee → token → Pons market

Do not assume undocumented Pons functions.

Before implementation, inspect the current deployed Pons contracts, ABI,
launch flow, fee model, and Robinhood Chain deployment.

Keep the Pons integration modular so an ABI or contract upgrade does not
require rewriting SHIFT.

------------------------------------------------------------------------

## 4. Shift Engine

Default V1 shift:

``` text
Shift Duration: 5 minutes
Snapshot Interval: 20 seconds
Expected Snapshots: 15
```

A shift starts only after the employee token has a confirmed Pons
launch.

Example:

``` text
00:00 Clock In
00:20 Snapshot
00:40 Snapshot
...
04:40 Snapshot
05:00 Final Snapshot
05:00 Shift Closed
```

Store:

``` ts
Shift {
  shiftId
  employeeId
  tokenAddress
  startedAt
  endedAt
  status
  averageMarketCap
  volume
  uniqueTraders
  holderCount
  liquidity
  performanceScore
  finalRank
  payrollAmount
}
```

Statuses:

``` text
PENDING
ACTIVE
FINALIZING
COMPLETED
INVALID
```

------------------------------------------------------------------------

## 5. Performance Engine

Do not rank employees using only a single final market-cap print.

V1 should favor sustained performance.

Suggested score:

``` text
Performance Score =
40% Average Market Cap Score
25% Volume Score
15% Holder/Unique Trader Score
10% Liquidity Score
10% Retention/Stability Score
```

Normalize each component before combining them.

Example:

``` text
score = (
  marketCapScore * 0.40 +
  volumeScore * 0.25 +
  participantScore * 0.15 +
  liquidityScore * 0.10 +
  stabilityScore * 0.10
)
```

Use average or time-weighted values across the shift where possible.

Avoid rewarding a token solely because of a one-block price spike.

The exact weights must live in configuration rather than being
hard-coded throughout the application.

------------------------------------------------------------------------

## 6. Anti-Manipulation

V1 needs basic manipulation resistance.

Detect or reduce the score impact of:

-   Same-wallet self trading
-   Obvious circular trading
-   Extremely short price spikes
-   Wash volume
-   Liquidity added immediately before scoring and removed immediately
    after
-   Sybil wallets where detectable
-   Failed/reverted trades
-   Duplicate indexed events

Prefer time-weighted market metrics.

Keep a raw snapshot trail so scores can be audited.

Flag suspicious shifts for exclusion instead of allowing arbitrary
backend edits to final results.

------------------------------------------------------------------------

## 7. Career System

Recommended initial hierarchy:

``` text
Intern
Analyst
Associate
Manager
VP
Director
C-Suite
CEO
```

Example configuration:

``` json
{
  "Intern": 0,
  "Analyst": 15,
  "Associate": 30,
  "Manager": 45,
  "VP": 60,
  "Director": 75,
  "C-Suite": 88,
  "CEO": 96
}
```

These values are placeholders. Tune them using testnet simulations
before mainnet.

The UI should make promotions highly visible.

Example:

``` text
PROMOTED

INTERN → MANAGER

Performance Score: 53.4
```

Ranks should affect payroll shares rather than simply acting as cosmetic
labels.

------------------------------------------------------------------------

## 8. Payroll Model

SHIFT needs a transparent Payroll Vault.

Revenue designated for employee payroll flows into:

``` text
PayrollVault
```

Do not hard-code an unverified assumption that all Pons creator fees can
automatically be redirected.

First verify exactly which Pons fees can be claimed, by whom, and
whether they can be programmatically routed.

The protocol should support configurable revenue allocation.

Example V1 configuration:

``` text
Employee Payroll Pool: configurable %
Protocol Treasury: configurable %
Other allocations: configurable / disabled by default
```

Payroll should be based on shares.

Example:

``` text
employeeShares =
performanceWeight × activeTimeWeight
```

Then:

``` text
employeePayroll =
payrollPool × employeeShares / totalEligibleShares
```

A user who joins halfway through an eligible payroll period should
receive only the appropriate time-weighted share.

All calculations should be reproducible from public inputs.

------------------------------------------------------------------------

## 9. Payroll Distribution

Two possible architectures:

### Option A: Push

Protocol automatically sends payroll to employees.

Pros: - Strong payday UX

Cons: - Higher gas - Large employee sets can cause transaction limits

### Option B: Claim

Finalize a payroll epoch and let employees claim.

Pros: - More scalable - Lower distributor execution risk

Recommended production architecture:

**Merkle-based claim system with optional automated claim service.**

Flow:

``` text
Revenue
↓
PayrollVault
↓
Payroll Epoch Finalized
↓
Merkle Root Published
↓
Employee Claims
↓
Wallet Receives Payroll
```

Never iterate through an unbounded employee array inside a single
onchain payout transaction.

------------------------------------------------------------------------

## 10. Payroll Epochs

Separate individual 5-minute shifts from payroll epochs.

Example:

``` text
Shift = 5 minutes
Payroll Epoch = configurable
```

This prevents the system from requiring a large distribution transaction
every five minutes.

For the initial demo, payroll epochs can be short.

For production, make the epoch configurable.

Store:

``` ts
PayrollEpoch {
  epochId
  startTime
  endTime
  grossRevenue
  payrollPool
  treasuryAmount
  merkleRoot
  finalizedAt
}
```

------------------------------------------------------------------------

## 11. Smart Contract Architecture

Suggested contracts:

``` text
ShiftRegistry.sol
EmployeeRegistry.sol
ShiftManager.sol
RankManager.sol
PayrollVault.sol
PayrollDistributor.sol
PonsAdapter.sol
Treasury.sol
```

Optional:

``` text
ConfigManager.sol
EmergencyPause.sol
```

### EmployeeRegistry.sol

Responsible for:

-   Employee IDs
-   Wallet mapping
-   Employee metadata hash/URI
-   Token mapping
-   Current rank

### ShiftManager.sol

Responsible for:

-   Opening shifts
-   Closing shifts
-   Shift state
-   Preventing duplicate active shifts
-   Recording finalized result hashes

### RankManager.sol

Responsible for:

-   Rank thresholds
-   Final rank assignment
-   Promotion events

### PayrollVault.sol

Responsible for:

-   Holding payroll-designated assets
-   Accounting by epoch
-   Authorized transfers to distributor

### PayrollDistributor.sol

Responsible for:

-   Epoch root
-   Claim verification
-   Preventing double claims
-   Payroll claim events

### PonsAdapter.sol

Responsible for:

-   Isolating Pons-specific calls
-   Mapping Pons markets to SHIFT employees
-   Fee-related calls supported by Pons

------------------------------------------------------------------------

## 12. Offchain Architecture

Do not put high-frequency market-data calculation directly onchain.

Recommended architecture:

``` text
Robinhood Chain
      ↓
Event Indexer
      ↓
Market Data Processor
      ↓
Snapshot Database
      ↓
Performance Engine
      ↓
Finalization Service
      ↓
SHIFT Contracts
```

Suggested stack:

``` text
Frontend: Next.js + TypeScript
Web3: viem / wagmi
Backend: Node.js / TypeScript
Database: PostgreSQL
Cache/Jobs: Redis
Indexer: custom EVM event indexer
Contracts: Solidity + Foundry
```

Use WebSockets where available for the live office.

------------------------------------------------------------------------

## 13. Data Integrity

Each finalized shift should have a reproducible result package.

Example:

``` json
{
  "shiftId": "123",
  "token": "0x...",
  "startBlock": 100,
  "endBlock": 200,
  "snapshotsHash": "0x...",
  "performanceScore": 72.41,
  "rank": "VP"
}
```

Hash the finalized result.

Store the hash onchain.

Keep the full snapshot data offchain.

This provides public proof without writing every 20-second snapshot to
the blockchain.

------------------------------------------------------------------------

## 14. Main UI

Visual direction:

-   Dark corporate interface
-   Minimal typography
-   Virtual-company feeling
-   Robinhood Chain native identity
-   Avoid copying the original 9-5 UI pixel-for-pixel

Hero:

``` text
SHIFT

Clock in. Launch. Perform. Get paid.

The onchain workforce powered by Pons.

[ CLOCK IN ] [ HOW SHIFT WORKS ]
```

Live status:

``` text
● SHIFT ACTIVE

24 employees working
8 active launches
Next payday: 03:42
```

------------------------------------------------------------------------

## 15. Live Office

The Live Office is one of the main differentiators.

Show employee cards/desks in real time.

Each employee can display:

``` text
Avatar
Employee name
Ticker
Rank
Current market cap
Performance score
Shift timer
Payroll earned
Status
```

Statuses:

``` text
CLOCKED IN
WORKING
PROMOTED
SHIFT COMPLETE
PAID
```

Clicking an employee opens the employee profile and Pons market.

A 3D office is optional.

Do not block MVP on 3D rendering.

Start with a fast 2D interactive office. Add 3D after the economic and
indexing systems work reliably.

------------------------------------------------------------------------

## 16. Employee Profile

Route:

``` text
/employee/[id]
```

Show:

``` text
Employee identity
Wallet
Token
Pons market
Current rank
Best rank
Current shift
Performance chart
Market-cap chart
Volume
Liquidity
Holders / unique participants
Total payroll
Shift history
Promotion history
Payroll history
Onchain proofs
```

------------------------------------------------------------------------

## 17. Leaderboard

Route:

``` text
/leaderboard
```

Views:

``` text
Current Shift
24 Hours
7 Days
All Time
```

Rank by:

``` text
Performance Score
Payroll Earned
Highest Rank
Average Market Cap
Volume
```

Do not rank only by token price.

------------------------------------------------------------------------

## 18. Payday UI

Route:

``` text
/payroll
```

Show:

``` text
Current payroll pool
Current epoch
Next payday
Employee shares
Estimated payroll
Previous payrolls
Claimable amount
Claim button
Transaction history
```

Example:

``` text
PAYDAY

Payroll Pool
12.42 ETH

Your Shares
4.81%

Estimated Pay
0.597 ETH

[ CLAIM PAY ]
```

Only show an estimate before finalization.

Clearly distinguish:

``` text
Estimated
Finalized
Claimable
Paid
```

------------------------------------------------------------------------

## 19. Public Proof

Every important action should expose its transaction or proof.

Examples:

``` text
Employee Created
Token Launched
Shift Started
Shift Finalized
Rank Assigned
Payroll Funded
Payroll Epoch Finalized
Payroll Claimed
```

UI:

``` text
View on Robinhood Chain Explorer ↗
View on Pons ↗
```

SHIFT should be easy to verify without trusting screenshots.

------------------------------------------------------------------------

## 20. Events

Suggested events:

``` solidity
event EmployeeCreated(
    uint256 indexed employeeId,
    address indexed wallet
);

event EmployeeTokenLinked(
    uint256 indexed employeeId,
    address indexed token,
    address ponsMarket
);

event ShiftStarted(
    uint256 indexed shiftId,
    uint256 indexed employeeId,
    uint256 startTime
);

event ShiftFinalized(
    uint256 indexed shiftId,
    uint256 performanceScore,
    uint8 rank,
    bytes32 resultHash
);

event Promotion(
    uint256 indexed employeeId,
    uint8 oldRank,
    uint8 newRank
);

event PayrollEpochFinalized(
    uint256 indexed epochId,
    uint256 payrollPool,
    bytes32 merkleRoot
);

event PayrollClaimed(
    uint256 indexed epochId,
    uint256 indexed employeeId,
    address indexed wallet,
    uint256 amount
);
```

------------------------------------------------------------------------

## 21. Security

Required:

-   Reentrancy protection
-   Checks-effects-interactions
-   Safe token transfers
-   Access-control separation
-   Multisig for treasury/admin
-   Pause capability
-   Claim replay protection
-   Merkle double-claim protection
-   Strict Pons adapter permissions
-   Input validation
-   Bounded arrays where possible
-   No arbitrary admin withdrawal from employee-allocated finalized
    payroll

Admin should never be able to silently modify a completed shift score.

If correction is required, use an explicit correction event and audit
trail.

------------------------------------------------------------------------

## 22. Failure Handling

Handle:

``` text
Pons launch reverted
RPC unavailable
Indexer behind chain head
Missing snapshot
Chain reorg
Market data unavailable
Employee disconnects frontend
Payroll finalization fails
Claim transaction fails
```

Frontend wallet disconnection must not stop an active shift.

Shift state must come from backend/onchain state, not the user's browser
session.

Wait for appropriate confirmation depth before treating critical events
as final.

------------------------------------------------------------------------

## 23. MVP

Build in this order.

### Phase 1: Research

-   Confirm Robinhood Chain network configuration
-   Inspect Pons contracts
-   Obtain current ABI
-   Understand launch transaction
-   Understand fee ownership
-   Understand creator-fee claiming
-   Identify market data sources
-   Test token creation manually

Deliverable:

``` text
PONS_INTEGRATION.md
```

Do not proceed with assumptions about Pons fee routing.

### Phase 2: Core Contracts

Build:

``` text
EmployeeRegistry
ShiftManager
RankManager
PayrollVault
PayrollDistributor
PonsAdapter
```

Write Foundry tests.

### Phase 3: Indexer

Index:

``` text
Employee launches
Pons trades
Liquidity changes
Relevant fee events
SHIFT events
```

### Phase 4: Performance Engine

Implement:

``` text
20-second snapshots
5-minute shifts
Normalization
Performance score
Rank calculation
Finalization hash
```

### Phase 5: Frontend

Build:

``` text
Landing
Clock In
Live Office
Employee Profile
Leaderboard
Payroll
Transaction Proof
```

### Phase 6: Testnet

Run simulated employees and adversarial scenarios.

Test:

``` text
Normal launch
High volume
Low volume
Pump then dump
Wash trading
Liquidity manipulation
Late clock-in
RPC failure
Reorg
Multiple simultaneous shifts
Payroll claims
Double claim
```

### Phase 7: Mainnet

Only deploy after:

``` text
Pons integration verified
Contracts tested
Indexer stable
Scoring reproducible
Payroll accounting reconciled
Admin permissions reviewed
End-to-end test completed
```

------------------------------------------------------------------------

## 24. V1 Acceptance Criteria

V1 is complete when a user can:

1.  Connect wallet.
2.  Clock in.
3.  Receive an employee identity.
4.  Launch an employee token through Pons.
5.  See the token appear in SHIFT.
6.  Start a five-minute shift.
7.  Watch live performance.
8.  Complete the shift.
9.  Receive a deterministic score.
10. Receive a rank.
11. Appear on the leaderboard.
12. Receive a payroll allocation.
13. Claim finalized payroll.
14. Verify launch, shift result, and payout using public proofs.

------------------------------------------------------------------------

## 25. Product Rules

Keep these principles throughout development:

``` text
Pons launches the markets.
SHIFT runs the company.

Market activity determines performance.
Sustained performance matters more than one spike.

Ranks must be deterministic.
Payroll must be auditable.
Finalized payroll must not depend on admin discretion.

Every employee has a public work history.
Every payday has public proof.
```

------------------------------------------------------------------------

## 26. Future Features

Do not block V1 for these.

Potential V2:

``` text
Departments
Teams
Company vs company seasons
Employee NFTs/badges
Promotion streaks
Demotion mechanics
Referral hiring
Team payroll
Performance bonuses
Office customization
3D office
CEO seasons
Weekly company reports
Public employee resumes
Pons ecosystem achievements
```

Potential departments:

``` text
Trading
Research
Engineering
Operations
Growth
Risk
```

------------------------------------------------------------------------

## 27. Final Product Experience

SHIFT should create this feeling:

``` text
I connected my wallet.
I clocked in.
SHIFT hired me.
My employee token launched through Pons.
The market determined how I performed.
My performance determined my position.
My position determined my payroll.
My payday is provable onchain.
```

The final product should feel like a living onchain company built around
Pons markets on Robinhood Chain.