import { keccak256 } from "js-sha3";

export type AddressValidationResult = {
  isValid: boolean;
  normalized?: string; // 0x-prefixed lowercase address
  checksummed?: string; // 0x-prefixed EIP-55 checksummed address
  error?: string;
};

/**
 * Computes the EIP-55 mixed-case checksum format for an Ethereum address.
 */
export function toChecksumAddress(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, "");
  const hash = keccak256(clean);
  let ret = "0x";
  for (let i = 0; i < clean.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += clean[i].toUpperCase();
    } else {
      ret += clean[i];
    }
  }
  return ret;
}

/**
 * Validates an Ethereum address format and EIP-55 mixed-case checksum.
 *
 * Validation policy:
 * 1. Must be a string matching `/^0x[0-9a-fA-F]{40}$/` (0x prefix + exactly 40 hex characters).
 * 2. If the address is all-lowercase or all-uppercase (excluding the '0x' prefix), it is accepted
 *    as a well-formed unchecksummed address, following standard web3 ecosystem practice.
 * 3. If the address has mixed casing, it is strictly validated against the EIP-55 checksum
 *    specification (keccak256 of lowercase hex characters; if nibble >= 8 uppercase, else lowercase).
 *    A mixed-case address with an invalid checksum is rejected.
 *
 * IMPORTANT DISCLAIMER (PRD ?4 P0 item 2):
 * Validating an address verifies only its syntactic structure and cryptographic checksum format.
 * Address validation or entry DOES NOT prove wallet control, ownership, or custody.
 */
export function validateEthereumAddress(address: string): AddressValidationResult {
  if (typeof address !== "string") {
    return { isValid: false, error: "Address must be a string" };
  }

  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    if (!trimmed.startsWith("0x")) {
      return { isValid: false, error: "Address must begin with '0x' prefix" };
    }
    if (trimmed.length !== 42) {
      return { isValid: false, error: `Address must be exactly 42 characters long, got ${trimmed.length}` };
    }
    return { isValid: false, error: "Address contains invalid non-hexadecimal characters" };
  }

  const hexPart = trimmed.slice(2);
  const lowerHex = hexPart.toLowerCase();
  const isAllLower = hexPart === lowerHex;
  const isAllUpper = hexPart === hexPart.toUpperCase();
  const checksummed = toChecksumAddress(trimmed);

  // If mixed case, strictly enforce EIP-55 checksum
  if (!isAllLower && !isAllUpper) {
    if (trimmed !== checksummed) {
      return {
        isValid: false,
        error: `Invalid EIP-55 mixed-case checksum for ${trimmed}. Expected ${checksummed}`
      };
    }
  }

  return {
    isValid: true,
    normalized: "0x" + lowerHex,
    checksummed
  };
}

export function isValidEthereumAddress(address: string): boolean {
  return validateEthereumAddress(address).isValid;
}
