# Signal Passport

High-integrity, deterministic, verifiable onchain passport for fintech applications. Built for the LOCK IN Hackathon (Fintech Track).

---

## Overview

Signal Passport analyzes an Ethereum wallet address over a fixed 30-day UTC observation window, evaluates successful outgoing transactions from public Blockscout REST v2 endpoints, computes three deterministic metrics, and seals the result in a tamper-evident, self-contained JSON passport bundle.

A downstream consumer (App Two) can independently import, validate, and verify the cryptographic integrity of any Signal Passport offline — without contacting blockchain RPCs, block explorers, AI providers, or App One.

---

## Architecture

The monorepo is organized into modular packages and two distinct, decoupled web applications:

```
signal-passport/
├── packages/
│   ├── schema/          # Shared Zod schemas and TypeScript contracts (PassportBundle, ObservationScope, Claims, Evidence)
│   ├── analysis/        # Blockscout v2 client, normalization, deduplication, 30-day UTC metrics, and coverage evaluation
│   └── verification/    # RFC 8785-compliant canonical JSON serialization, SHA-256 hashing, and bundle integrity verification
├── apps/
│   ├── passport/        # App One: Generator application (Next.js 15, port 3000)
│   └── consumer/        # App Two: Independent verifier application (Next.js 15, port 3001, ZERO analysis/network dependencies)
├── fixtures/
│   └── real/            # Real-world Blockscout transaction fixtures (100 raw items across 2 pages) and verified bundle
└── tests/               # 53 automated unit and integration tests (test runner: node:test + tsx)
```

### The Non-Negotiable Structural Rule (PRD §9)

**App Two (`apps/consumer`) is a completely separate application and process.**
- Zero runtime dependency on `@signal-passport/analysis`
- Zero blockchain RPC or upstream explorer network calls
- Performs all validation and SHA-256 digest recomputation using only shared schema and canonical serialization primitives.

---

## Prerequisites

- **Node.js**: >= 20.0.0 (Node.js 24 recommended)
- **npm**: >= 10.0.0
- **Operating System**: Windows, macOS, or Linux

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

---

## Running the Automated Test Suite

Signal Passport contains 53 automated tests covering address validation, UTC boundary logic, deduplication, deterministic metrics calculation, canonical serialization, SHA-256 tamper-evident integrity verification, provider error resilience, and edge states:

```bash
npm test
```

All 53 tests run via Node's native test runner with `tsx`.

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

## End-to-End Demo Walkthrough (PRD §15)

1. **Open App One** at `http://localhost:3000`.
2. **Enter or select the test wallet address**:
   Click the example address button to load:
   `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8`
3. **Click "Analyze Wallet"**:
   Observe real-time pipeline progress streamed via NDJSON:
   - `FETCHING`: Queries Blockscout REST v2 API for outgoing transactions.
   - `NORMALIZING`: Filters by 30-day UTC window, `status=ok`, and deduplicates transactions.
   - `CALCULATING`: Derives the 3 deterministic metrics, evaluates coverage, and generates canonical SHA-256 digest.
   - `COMPLETE`: Displays subject overview and metric cards.
4. **Explore the Results**:
   - **Observed Transactions**: 28 transactions
   - **Active Days (UTC)**: 19 days
   - **Unique Recipients**: 16 addresses
   - Click any metric card to open the **Evidence Drill-down table** showing supporting transaction hashes, UTC timestamps, recipients, and direct Blockscout explorer links.
5. **Export the Passport**:
   Click **"📥 Export Passport Bundle (.json)"** to download the sealed bundle.
6. **Open App Two** at `http://localhost:3001`.
7. **Import the Passport**:
   Drag and drop or select the downloaded JSON file in App Two's dropzone.
8. **Verify Offline Integrity**:
   App Two independently runs 4 sequential verification checks:
   - Step 1: Schema conformance check (`passportBundleSchema`)
   - Step 2: Subject address format validation (`0x` prefix, 42 chars, hex)
   - Step 3: Self-contained evidence consistency (all claim evidence IDs exist)
   - Step 4: Local canonical serialization and SHA-256 digest recomputation
   - Displays **"Bundle integrity matched"** and displays all claims and metadata read directly from the bundle without any external network access.

---

## Reliability & Edge States (PRD §14)

Signal Passport explicitly handles all four edge states defined in the specification:

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

## Building for Production

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

## Verification & Auditing

Detailed audit trails and milestone verification reports are maintained under `docs/`:
- `docs/METHODOLOGY.md`: Deterministic metrics specification and UTC boundary rules.
- `docs/REUSE.md`: Source code reuse log and line-by-line audit from LedgerLens.
- `docs/verification/M0.md`: Data-access research and Blockscout REST v2 fixture audit.
- `docs/verification/M1.md`: Normalization, address validation, and metrics test audit.
- `docs/verification/M2.md`: Canonical serialization and SHA-256 integrity audit.
- `docs/verification/M3.md`: Cross-application independence and dual-app verification.
- `docs/verification/M4.md`: Reliability, edge states, and clean-clone verification.
- `STATUS.md`: Project milestones, acceptance criteria, and technical lead review log.
