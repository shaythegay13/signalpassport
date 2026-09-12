# Signal Passport

> High-integrity, deterministic, verifiable onchain passport for fintech applications. Built for the LOCK IN Hackathon (Fintech Track).

---

## What is Signal Passport?

Signal Passport solves the repeated wallet-analysis problem in fintech: instead of every downstream application repeatedly querying RPCs, indexing transactions, and recomputing metrics from scratch, Signal Passport evaluates a subject's onchain history over a declared observation window, computes deterministic verifiable metrics with direct evidence pointers, and seals the result into a portable, tamper-evident JSON bundle.

An independent consumer application (App Two) can import, validate, and verify the cryptographic integrity of any Signal Passport offline — without contacting blockchain RPCs, block explorers, AI providers, or App One.

---

## Architecture & Monorepo Layout

Signal Passport is structured as clean TypeScript packages and two completely decoupled web applications:

```
signal-passport/
├── packages/
│   ├── schema/          # Shared Zod schemas and TypeScript contracts (PassportBundle, ObservationScope, Claims, Evidence)
│   ├── analysis/        # Blockscout v2 client, normalization, deduplication, 30-day UTC metrics, coverage evaluation, AI explanation
│   └── verification/    # RFC 8785-compliant canonical JSON serialization, SHA-256 hashing, and bundle integrity verification
├── apps/
│   ├── passport/        # App One: Generator application (Next.js 15, port 3000)
│   └── consumer/        # App Two: Independent verifier application (Next.js 15, port 3001, ZERO analysis/network dependencies)
├── fixtures/
│   └── real/            # Real-world Blockscout transaction fixtures (100 raw items across 2 pages) and verified bundles
├── docs/                # Comprehensive methodology, reuse disclosure, demo script, and milestone verification reports
└── tests/               # 63 automated unit and integration tests (test runner: node:test + tsx)
```

### The Non-Negotiable Structural Rule (PRD §9)

**App Two (`apps/consumer`) is a completely separate application and process, not a route in App One.**
- **Zero runtime dependency** on `@signal-passport/analysis` or Blockscout
- **Zero network requests** during import and verification
- Recomputes SHA-256 digest from first principles using only `@signal-passport/verification` and `@signal-passport/schema`
- Runs and verifies bundles even when App One is completely stopped

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (Node.js 24 recommended)
- **npm**: `>= 10.0.0`
- **Operating System**: Windows, macOS, or Linux
- *Note for Windows PowerShell*: Use `npm.cmd` if script execution policy restricts `npm.ps1`.

---

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url> signal-passport
   cd signal-passport
   ```

2. **Install root dependencies:**
   ```bash
   npm install
   ```

3. **Install application dependencies:**
   ```bash
   npm install --prefix apps/passport
   npm install --prefix apps/consumer
   ```

4. **Environment Configuration (Optional — P0 requires no keys):**
   P0 runs completely out of the box with zero credentials using public Blockscout REST v2 endpoints.
   If you wish to test the optional AI explanation layer (P0b), create `.env.local` in the repository root:
   ```bash
   AI_PROVIDER=groq
   GROQ_API_KEY=your_groq_key_here
   # Optional fallback:
   # ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

---

## Running the Automated Test Suite

Signal Passport contains **63 automated tests** covering address validation, UTC boundary logic, deduplication, deterministic metrics calculation, canonical serialization, SHA-256 tamper-evident integrity verification, provider error resilience, coverage checks, AI grounding rules, and edge states:

```bash
npm test
```

*(On Windows PowerShell, use `npm.cmd test`)*

All 63 tests run via Node's native test runner (`node:test`) with `tsx`.

---

## Running the Applications

### App One: Passport Generator (Port 3000)
```bash
npm run dev:passport
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### App Two: Independent Consumer (Port 3001)
In a separate terminal:
```bash
npm run dev:consumer
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Fast No-Network Demo Path (Instant Verification)

If you want to evaluate the offline verification pipeline immediately without any network calls or waiting for block explorers:

1. Start **App Two only** on port 3001:
   ```bash
   npm run dev:consumer
   ```
2. Open [http://localhost:3001](http://localhost:3001).
3. Drag and drop the pre-generated real fixture bundle from `fixtures/real/passport-bundle.json` into App Two's dropzone.
4. App Two immediately executes all 4 verification checks offline:
   - Schema conformance → Address validation → Evidence reference integrity → Canonical SHA-256 recomputation.
5. Observe the **"Bundle integrity matched"** badge, the verified metrics (28 txs, 12 active days, 10 recipients), and the complete evidence table.

---

## End-to-End Walkthrough (PRD §15)

Follow this full flow to experience both applications end to end:

1. **Launch App One** at `http://localhost:3000`.
2. **Select Test Subject**:
   - Click the example wallet button to load `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8` (the frozen M0 test EOA on Ethereum Mainnet).
3. **Analyze Wallet**:
   - Click **"Analyze Wallet"**.
   - Watch the real-time NDJSON streaming pipeline stages: `FETCHING` → `NORMALIZING` → `CALCULATING` → `COMPLETE`.
4. **Inspect Metrics & Evidence**:
   - **Observed Transactions**: 28 transactions
   - **Active Days (UTC)**: 12 calendar days
   - **Unique Recipients**: 10 recipient addresses
   - Click any metric card to open the **Evidence Drill-Down** table. Every metric is backed by explicit transaction hashes, UTC timestamps, block numbers, and Blockscout explorer links.
5. **(Optional) Generate AI Explanation (P0b)**:
   - Click **"Generate AI Explanation"** in the Qualitative Synthesis card.
   - A model synthesis will generate, cite verified evidence IDs, and pass strict grounding validation before display.
   - If keys are omitted or the model fails, it seamlessly falls back to a deterministic template without blocking.
6. **Export the Passport**:
   - Click **"📥 Export Passport Bundle (.json)"** to download the sealed bundle file.
7. **Stop App One**:
   - In the App One terminal, press `Ctrl+C` to shut down the server.
8. **Launch App Two** at `http://localhost:3001` (`npm run dev:consumer`).
9. **Import into App Two**:
   - Drag and drop or select the exported `.json` file.
10. **Verify Independence & Cryptographic Integrity**:
    - App Two runs all 4 checks locally without any network connection.
    - Confirms **"Bundle integrity matched"** with exact payload digest match.
    - Displays all claims, coverage status, evidence table, and unverified display metadata.
11. **Demonstrate Tamper Rejection**:
    - Open the exported `.json` file in any text editor.
    - Change one metric value (e.g., change `value: 28` to `value: 99`).
    - Save and drop the edited file into App Two.
    - App Two immediately flags **"Bundle integrity mismatch"**, identifying that the recomputed SHA-256 digest does not match the sealed integrity record.

---

## Originality & Reuse Disclosure

Signal Passport was built from scratch for the LOCK IN Hackathon. A complete, line-by-line audit is recorded in [`docs/REUSE.md`](docs/REUSE.md).

- **Total Codebase Size**: **4,881 lines of TypeScript/TSX** (1,510 lines in `packages/`, 1,475 lines in `apps/`, 1,896 lines in `tests/`).
- **Reused from LedgerLens**: Approximately **90 lines of AI plumbing and configuration patterns** in optional stretch scope (P0b):
  - Provider registry abstraction (`packages/analysis/src/ai/provider.ts` adapted from `ledgerlens/lib/ai-provider.ts`).
  - 5-stage validation pipeline shape (`packages/analysis/src/ai/validation.ts` adapted from `ledgerlens/lib/ai-analysis.ts`).
- **100% Newly Authored (P0 Core)**:
  - Address validation and EIP-55 checksumming.
  - Blockscout REST v2 API adapter and cursor pagination.
  - Normalized onchain evidence model and stable evidence IDs (`1:<txHash>`).
  - UTC calendar day bucketing and 3 deterministic metrics.
  - Coverage evaluation (`complete_for_query`, `partial`, `unknown`).
  - RFC 8785 canonical JSON serializer with recursive key sorting and safe BigInt handling.
  - SHA-256 cryptographic payload digest computation and tamper detection.
  - Shared Zod schema contracts (`packages/schema`).
  - App One generator and App Two independent offline consumer.
  - Complete 63-test verification suite.

*Per PRD §5: We do not assert a percentage of new code; eligibility remains the hackathon hosts' decision.*

---

## What is NOT Implemented & Why

- **Monad Testnet Registry (P1 Stretch Scope)**:
  - *Status*: **Not implemented.**
  - *Rationale*: Per PRD §4 and §13, P1 was strictly gated behind full P0 acceptance and required at least 4 discretionary hours before the submission deadline buffer. Rather than rushing an unverified testnet deployment that risked presenting localhost references as public storage, we prioritized delivering a bulletproof, fully tested P0 evidence and offline verification protocol with genuine cross-app independence.
- **Financial Variance & Business Memory**:
  - *Status*: **Intentionally omitted.**
  - Per PRD §5 prohibitions, LedgerLens's financial variance analysis and editable memory logic were excluded to ensure Signal Passport remains an objective, factual, and tamper-evident protocol.

---

## Reliability & Edge States (PRD §14)

1. **Zero Qualifying Activity**:
   - Wallets with zero outgoing transactions in the observation window produce a valid passport with `claims: []` and all three metrics displayed as `0`.
   - The bundle seals and exports normally, and App Two verifies it cleanly through all 4 checks.
2. **Pre-flight Address Validation**:
   - Malformed addresses, incorrect length, non-hex characters, and invalid EIP-55 mixed-case checksums are rejected locally before any network call is dispatched.
3. **Provider Outage Resilience**:
   - Upstream Blockscout downtime (HTTP 503, connection errors, rate limits) surfaces as a distinct operational failure card.
   - **PRD §14 Invariant**: Provider failure is *never* conflated with zero activity and never generates an empty passport.
4. **Partial Coverage Handling**:
   - When pagination limits prevent exhausting transaction history, the passport is explicitly stamped with `coverageStatus: "partial"`.
   - Both App One and App Two prominently render a yellow warning badge and warning alert notifying users that activity may be undercounted.

---

## Production Builds

To build optimized production bundles for both applications:

```bash
npm run build:passport
npm run build:consumer
```

Start production servers:
```bash
npm run start --prefix apps/passport    # Port 3000
npm run start --prefix apps/consumer    # Port 3001
```

---

## Verification & Auditing Documentation

Comprehensive verification reports documenting every milestone are available in `docs/`:
- [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md): Deterministic metrics specification and UTC boundary rules.
- [`docs/REUSE.md`](docs/REUSE.md): Source code reuse log and line-by-line originality audit.
- [`docs/demo-script.md`](docs/demo-script.md): Step-by-step timed demo script and rehearsal log.
- [`docs/verification/M0.md`](docs/verification/M0.md): Data-access research and Blockscout REST v2 fixture audit.
- [`docs/verification/M1.md`](docs/verification/M1.md): Normalization, address validation, and metrics test audit.
- [`docs/verification/M2.md`](docs/verification/M2.md): Canonical serialization and SHA-256 integrity audit.
- [`docs/verification/M3.md`](docs/verification/M3.md): Cross-application independence and dual-app verification.
- [`docs/verification/M4.md`](docs/verification/M4.md): Reliability, edge states, and clean-clone verification.
- [`docs/verification/M5.md`](docs/verification/M5.md): AI qualitative synthesis, grounding validation, and fallback audit.
- [`STATUS.md`](STATUS.md): Complete project milestone ledger and reviewer audit trail.
