# Fixtures Directory Structure

This directory contains test datasets used for Signal Passport development and verification:

- `fixtures/real/`: Contains genuine, unmodified responses retrieved directly from public blockchain data providers (e.g. Blockscout REST v2), accompanied by sibling `metadata.json` records capturing full retrieval parameters, frozen blocks, observation windows, and query configurations.
- `fixtures/synthetic/`: Reserved strictly for synthetic test cases, edge cases (e.g. zero activity, corrupted digests, malformed payloads), and unit tests.

**Policy:** Synthetic data is strictly for automated unit and edge-case testing. Synthetic data NEVER appears in user demos or exported production passports.
