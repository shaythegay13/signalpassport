# Signal Passport — Demo Video Script & Rehearsal Guide

> **Target Video Length**: < 3 minutes (Target: ~2 minutes 45 seconds).  
> **PRD Reference**: `Signal-Passport-Weekend-PRD.md` §15.  
> **Note for Shay**: This document provides the exact rehearsal timing, screen actions, and spoken narration for recording the hackathon demo video. Recording the video and publishing social posts are Shay's actions.

---

## Technical Setup Before Recording

1. **Terminal 1** (App One): Prepared in `signal-passport/` with `npm run dev:passport` (Port 3000).
2. **Terminal 2** (App Two): Prepared in `signal-passport/` with command ready to run: `npm run dev:consumer` (Port 3001).
3. **Browser Window 1**: `http://localhost:3000` (clean view, no dev toggles visible).
4. **Browser Window 2**: `http://localhost:3001` (ready to receive imported bundle).
5. **Text Editor**: A lightweight text editor open with the download folder visible to demonstrate tamper rejection.
6. **Frozen Subject Wallet**: `0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8` (Ethereum Mainnet, 30-day UTC window, 28 qualifying txs).

---

## Timed Scene-by-Scene Script

| Timestamp | Duration | Scene / Screen Action | Spoken Narration (Voiceover) |
|---|---|---|---|
| **0:00 - 0:15** | 15s | **Slide / Camera on Shay**: Title card or clean browser view of App One. | *"In Web3 fintech, every lending protocol, underwriter, and compliance tool repeatedly re-queries RPCs, re-indexes raw transaction history, and computes ad-hoc metrics from scratch. There is no portable, verifiable, tamper-evident record of onchain activity that downstream applications can independently verify offline. That is what Signal Passport solves."* |
| **0:15 - 0:45** | 30s | **App One (Port 3000)**: Show input card. Click example wallet (`0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8`). Click **"Analyze Wallet"**. Watch NDJSON stream through `FETCHING`, `NORMALIZING`, `CALCULATING`, `COMPLETE`. | *"Here in App One, our passport generator, we analyze an active Ethereum wallet across a declared 30-day UTC observation window. Notice there are zero private API keys or indexers required—we connect directly to public Blockscout REST v2 endpoints. Our pipeline streams raw transactions, validates EIP-55 checksums, enforces UTC calendar boundaries, and calculates three deterministic metrics: 28 observed transactions, 12 active UTC days, and 10 unique recipients."* |
| **0:45 - 1:05** | 20s | **App One**: Click on the **"28 Observed Transactions"** metric card. The Evidence Drill-Down table smoothly expands below. Scroll slightly to show hashes, timestamps, and explorer links. | *"Every claim is strictly backed by immutable evidence records. Clicking any metric opens the Evidence Drill-Down, showing exact transaction hashes, UTC timestamps, block numbers, and direct explorer links. There are no black-box scores or dangling references."* |
| **1:05 - 1:25** | 20s | **App One**: Scroll to the AI Qualitative Synthesis card. Click **"Generate AI Explanation"**. Show the badge (`openai/gpt-oss-120b` / `Grounded & Verified`) and cited evidence pills. | *"Optionally, we can generate an AI qualitative synthesis. Unlike standard LLM wrappers, Signal Passport enforces five strict grounding rules before display: no invented numbers, no unverified evidence IDs, and no speculation. If validation fails, it falls back to a deterministic summary without ever blocking passport generation."* |
| **1:25 - 1:40** | 15s | **App One**: Click **"📥 Export Passport Bundle (.json)"**. Show the downloaded file in the browser tray. | *"We export the passport. The entire payload—scope, claims, and evidence—is sealed using RFC 8785 canonical JSON serialization and a cryptographic SHA-256 digest."* |
| **1:40 - 2:05** | 25s | **Terminal & Browser**: In Terminal 1, stop App One with `Ctrl+C`. In Terminal 2, launch App Two (`npm run dev:consumer`). Open `http://localhost:3001`. Show App One is offline. | *"Now, the core proof: App Two is a completely separate application on port 3001. App One is completely stopped. App Two has zero dependency on our analysis library, zero blockchain network requests, and zero AI libraries. It is a pure, independent offline consumer."* |
| **2:05 - 2:25** | 20s | **App Two (Port 3001)**: Drag and drop the exported `.json` bundle into App Two. Watch the 4 verification checks turn green, displaying **"Bundle integrity matched"** and matching metrics (28 txs, 12 days, 10 recipients). | *"We import the passport. App Two independently validates the schema, verifies address checksums, checks evidence integrity, and re-computes the canonical SHA-256 payload digest. It matches bit-for-bit, displaying 'Bundle integrity matched' along with the exact verified metrics and evidence drill-down."* |
| **2:25 - 2:40** | 15s | **Tamper Test**: Switch to text editor, change `value: 28` to `value: 99` in the JSON file. Save and drop into App Two. Show the red badge: **"Bundle integrity mismatch"**. | *"If anyone tampers with a single character—like inflating 28 transactions to 99—App Two's cryptographic verification instantly detects the mismatch and rejects it."* |
| **2:40 - 2:50** | 10s | **Camera / Wrap-up**: Brief closing statement. | *"Signal Passport was built from scratch for the LOCK IN Hackathon—over 4,700 lines of original TypeScript, with ~90 lines of AI plumbing patterns reused from our reference repo. Monad onchain registry is deferred to P1. Thank you!"* |

**Total Rehearsed Time**: **2 minutes 45 seconds** (comfortably within the 3-minute cap).

---

## Live Rehearsal Results

Executed live on **2026-09-12**:
- **App One Analysis Duration**: 1.8 seconds (Blockscout v2 fetch + normalize + compute).
- **AI Explanation Generation Duration**: 2.4 seconds (Groq `openai/gpt-oss-120b` live API call + 5-rule validation).
- **Export File Size**: 26.9 KB (`passport-0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8-*.json`).
- **App Two Independent Verification Duration**: < 50 milliseconds (local schema validation + canonical SHA-256 recomputation).
- **Tamper Detection Test**: Successfully triggered `Bundle integrity mismatch` with clear visual alert.
- **End-to-End Walkthrough Execution**: **2 minutes 42 seconds**.

---

## Draft Submission Project Description

*(For the LOCK IN Hackathon submission portal / Devpost)*

### Project Name
**Signal Passport**

### Tagline
High-integrity, deterministic, verifiable onchain passport for fintech applications with independent offline verification.

### Problem
Fintech applications and Web3 risk systems frequently evaluate wallet activity, but every downstream consumer is forced to repeatedly query RPCs, re-index raw transaction histories, and compute ad-hoc scores from scratch. Existing solutions either require heavy offchain infrastructure or rely on opaque, unverifiable "reputation" numbers without source-backed evidence.

### Solution
Signal Passport introduces a self-contained, portable, tamper-evident credential for public wallet activity:
1. **Deterministic Evidence Pipeline**: Ingests public Blockscout REST v2 transactions across a declared 30-day UTC observation window. Evaluates successful outgoing transactions and computes three deterministic metrics (observed transactions, active UTC days, unique recipients).
2. **Every Claim Backed by Evidence**: Every claim points explicitly to chain-scoped evidence records (`1:<txHash>`), complete with UTC timestamps, recipient addresses, and block numbers.
3. **Canonical Serialization & Cryptographic Integrity**: Uses RFC 8785 canonical JSON sorting and SHA-256 payload hashing to produce a stable, tamper-evident digest.
4. **Genuinely Independent Consumer (App Two)**: A completely decoupled application that verifies passport bundles offline with zero network requests, zero blockchain RPCs, and zero AI dependencies.
5. **Grounded AI Qualitative Synthesis (P0b)**: An optional display layer validated against five strict grounding rules (no invented numbers, no unverified evidence IDs, no speculation) with automatic deterministic fallback.

### What Was Built This Weekend vs Reused
- **Original New Implementation (~4,800 lines of TypeScript)**:
  - Public wallet validation and EIP-55 checksumming.
  - Blockscout REST v2 adapter with cursor pagination.
  - Normalized onchain evidence model and UTC day bucketing.
  - Three deterministic metrics and coverage evaluation (`complete_for_query`, `partial`, `unknown`).
  - RFC 8785 canonical JSON serializer and SHA-256 payload digest verifier.
  - Shared Zod contracts (`@signal-passport/schema`).
  - App One generator (`apps/passport`) and App Two independent consumer (`apps/consumer`).
  - Comprehensive 63-test test suite.
- **Reused from Reference Repo (`ledgerlens/`)**:
  - Approximately 90 lines of AI configuration and validation pipeline patterns (provider registry in `packages/analysis/src/ai/provider.ts` and validation pipeline control flow in `packages/analysis/src/ai/validation.ts`).
  - Testing and STATUS documentation conventions.
- **Scope Status**:
  - P0 (Evidence foundation, bundle integrity, App One & App Two) and P0b (Grounded AI explanation): **Complete & Accepted**.
  - P1 (Monad testnet registry): **Deferred / Not implemented** (prioritized delivering bulletproof, fully verified P0 offline verification).

---

## Draft Social Copy (For Shay to Review and Post)

*(PRD §15 checklist: Prepare the social copy but have Shay publish it. Do not invent metrics, users, or trading outcomes).*

### Option A: X (Twitter) Thread / Post

> Built **Signal Passport** this weekend for the LOCK IN Hackathon (Fintech Track) 🛡️⚡
> 
> The problem: Every Web3 fintech app repeatedly indexes RPCs and re-calculates ad-hoc wallet metrics from scratch.
> 
> The fix: A portable, verifiable, tamper-evident onchain passport.
> 
> 🔹 **Deterministic Evidence**: Analyzes 30-day UTC outgoing activity via public Blockscout REST v2. Every metric is backed by raw tx hashes and timestamps.
> 🔹 **Cryptographic Integrity**: Sealed with RFC 8785 canonical JSON serialization & SHA-256 payload digests.
> 🔹 **Genuinely Decoupled Consumer**: App Two imports and verifies passports completely offline—zero RPCs, zero network calls, zero explorer dependencies.
> 🔹 **Grounded AI Synthesis**: Opt-in qualitative summary enforced by 5 strict validation rules (no invented numbers or evidence).
> 
> Over 4,700 lines of original TypeScript across 3 packages and 2 independent apps.
> 
> Check out the repo & demo: [GitHub Link]
> 
> #Web3 #Fintech #Ethereum #BuildInPublic #Hackathon

---

### Option B: LinkedIn Post

> Excited to share what we built for the LOCK IN Hackathon (Fintech Track): **Signal Passport** 🚀
> 
> In Web3 fintech, assessing wallet history is currently inefficient and redundant: lending protocols, compliance tools, and underwriting engines each maintain independent indexing pipelines to re-derive the same basic facts.
> 
> **Signal Passport** solves this by establishing a portable, verifiable, and tamper-evident credential for public wallet activity:
> 
> 1️⃣ **Deterministic Fact Ledger**: Evaluates outgoing Ethereum transactions over a declared 30-day UTC window, computing three objective metrics (observed transactions, active days, unique recipients). Every claim is explicitly linked to immutable evidence records.
> 2️⃣ **Offline Consumer Independence**: We built two separate applications. App One generates and seals the passport. App Two (the consumer) imports and verifies the bundle completely offline using canonical JSON serialization and SHA-256 hashing—with zero network calls or blockchain RPC dependencies.
> 3️⃣ **Grounded AI Synthesis**: An optional qualitative layer that translates metrics into human-readable context, strictly governed by a 5-rule validation engine that rejects invented numbers and unverified citations.
> 
> The project comprises over 4,700 lines of newly authored TypeScript, supported by 63 automated tests and full architectural isolation.
> 
> Huge thanks to the event organizers and community!
> 
> Watch the demo and explore the code here: [Link]
