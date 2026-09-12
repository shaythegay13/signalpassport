import test from "node:test";
import assert from "node:assert/strict";
import { validateEthereumAddress, toChecksumAddress, isValidEthereumAddress } from "../packages/analysis/src/address.js";

test("address validation: accepts valid EIP-55 checksummed mixed-case address", () => {
  const checksummed = "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";
  const result = validateEthereumAddress(checksummed);
  assert.equal(result.isValid, true);
  assert.equal(result.checksummed, checksummed);
  assert.equal(result.normalized, checksummed.toLowerCase());
  assert.equal(isValidEthereumAddress(checksummed), true);
});

test("address validation: accepts valid all-lowercase unchecksummed address", () => {
  const lower = "0xc82f8b79cd34bd98b1abec72475f2a73eb15cfa8";
  const result = validateEthereumAddress(lower);
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, lower);
  assert.equal(result.checksummed, "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8");
  assert.equal(isValidEthereumAddress(lower), true);
});

test("address validation: accepts valid all-uppercase unchecksummed address", () => {
  const upper = "0xC82F8B79CD34BD98B1ABEC72475F2A73EB15CFA8";
  const result = validateEthereumAddress(upper);
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, upper.toLowerCase());
  assert.equal(result.checksummed, "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8");
});

test("address validation: rejects malformed address missing 0x prefix", () => {
  const missing0x = "c82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";
  const result = validateEthereumAddress(missing0x);
  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /must begin with '0x'/);
});

test("address validation: rejects malformed address with incorrect length", () => {
  const tooShort = "0x1234567890abcdef";
  const result = validateEthereumAddress(tooShort);
  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /must be exactly 42 characters/);
});

test("address validation: rejects malformed address with non-hex characters", () => {
  const nonHex = "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";
  const result = validateEthereumAddress(nonHex);
  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /non-hexadecimal/);
});

test("address validation: rejects mixed-case address with corrupted EIP-55 checksum", () => {
  const corrupted = "0xc82f8b79Cd34bD98b1abEC72475F2a73Eb15CFA8";
  const result = validateEthereumAddress(corrupted);
  assert.equal(result.isValid, false);
  assert.match(result.error ?? "", /Invalid EIP-55 mixed-case checksum/);
  assert.equal(isValidEthereumAddress(corrupted), false);
});
