# Signal Passport ? Methodology & Evidence Specification

Version: 1.0 | Date: 2026-09-12
Governing scope: `Signal-Passport-Weekend-PRD.md` (?7 Evidence and metrics, ?8 Data contract).

---

## 1. Evidence Identifier Scheme

Evidence identifiers must be stable, deterministic, and chain-scoped. They must never depend on array position, retrieval timestamp, or pagination page index.

### Transaction-Level Evidence (Default)
For standard transaction-level ingestion (such as Blockscout's `filter=from` endpoint):

```
evidenceId = "${chainId}:${transactionHash.toLowerCase()}"
```

Example:
`1:0xfa528e0a3f8eafb1adcbec940bd5897d2269b63fd02fbc53c0b3cd105f30c283`

### Event Log-Level Evidence (Future Expansion)
If log-based events are incorporated:
```
evidenceId = "${chainId}:${transactionHash.toLowerCase()}:${logIndex}"
```

Per PRD ?7, log index is preserved in the evidence ID while unique transactions are still counted and deduplicated separately by `chainId + transactionHash`.

---

## 2. Address Validation & Checksum Policy

Address validation is implemented in `packages/analysis/src/address.ts`:

1. **Shape**: Must match `^0x[0-9a-fA-F]{40}$` (0x prefix followed by exactly 40 hexadecimal characters).
2. **Unchecksummed Addresses**: An address that is all-lowercase or all-uppercase (excluding `0x`) is accepted as a valid, well-formed unchecksummed address, following standard web3 ecosystem convention.
3. **Mixed-Case Addresses**: An address containing mixed uppercase and lowercase characters is strictly validated against the **EIP-55** specification:
   - Compute Keccak-256 hash of the lowercase address string (without `0x`).
   - For character `i`, if the `i`-th nibble of the hash is `>= 8`, the character must be uppercase; otherwise it must be lowercase.
   - Any checksum mismatch is rejected with an actionable error message.

> [!IMPORTANT]
> **Wallet Ownership Disclaimer (PRD ?4 P0 item 2):** Validating an address format or checksum establishes only that the string is a syntactically and cryptographically valid public key hash. Address entry or validation **DOES NOT prove wallet control, custody, or authorization**.

---

## 3. Qualifying Transaction Scope

Per PRD ?7, the default qualifying scope is **successful outgoing transactions from the subject wallet within the declared UTC observation window**:

1. **Direction**: `from.hash.toLowerCase() === subjectAddress.toLowerCase()`. Incoming transfers and third-party transactions are excluded.
2. **Execution Status**: `status === "ok"` or `result === "success"`. Reverted or failed transactions are excluded from qualifying activity.
3. **Observation Window**: The transaction timestamp must satisfy:
   `window.startUtc <= timestamp <= window.endUtc`
   Both bounds are evaluated as UTC ISO 8601 timestamps. The end boundary is frozen to a specific block and timestamp to prevent dynamic dataset drift.

---

## 4. Deduplication Rule

Before calculating any metrics, qualifying records are deduplicated by `${chainId}:${transactionHash.toLowerCase()}`. The first occurrence is preserved. Duplicate records never inflate transaction counts or metrics.

---

## 5. Deterministic Metrics Definition & Required Wording

The three P0 metrics are defined strictly deterministically from the deduplicated qualifying evidence set:

| Metric | Type | Definition | Required Label Wording (PRD ?7) |
|---|---|---|---|
| **Observed transaction count** | `observed_transaction_count` | Count of distinct qualifying transaction hashes. | *"Observed transactions"* |
| **Active days** | `active_days` | Count of distinct UTC calendar dates (`YYYY-MM-DD` in UTC) containing at least one qualifying transaction. | *"Active days within this dataset"* |
| **Unique recipients** | `unique_recipients` | Count of distinct non-null destination addresses (`to.hash.toLowerCase()`) among qualifying outgoing transactions. | *"Unique recipient addresses"* |

### Grounding & Constraints:
- Every metric produces a `Claim` object conforming to `packages/schema`.
- Every claim's `evidenceIds` array strictly references real `EvidenceRecord` identifiers present in the dataset. No dangling or invented evidence IDs are permitted.
- PRD ?7 prohibits inferring protocol expertise, trading behavior, or identity from these metrics. Specifically, unique recipients must be labeled "Unique recipient addresses", never "protocols used".

---

## 6. Coverage Status & Pagination Metadata

Coverage status communicates the completeness of the retrieved dataset relative to the declared observation query:

- **`complete_for_query`**: The query paginated to `next_page_params: null` within the declared observation window without hitting any provider-imposed limit or truncation.
- **`partial`**: The provider indicated additional data exists beyond what was fetched (e.g. maximum page limit reached), or a network/provider error occurred after partial pages were retrieved.
- **`unknown`**: The coverage state could not be conclusively determined.

### Persisted Metadata:
Alongside the coverage status, the following metadata is recorded:
- `pageCount`: Number of pages retrieved
- `isTruncated`: Boolean indicating if truncation occurred
- `totalRowsRetrieved`: Total raw rows returned across all pages
- `matchingRowsCount`: Qualifying rows matching the declared scope
- `details`: Human-readable summary of the query boundaries
