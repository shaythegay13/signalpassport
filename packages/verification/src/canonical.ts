/**
 * Canonical JSON Serialization
 *
 * Implements deterministic canonical JSON serialization per Signal Passport PRD §8:
 * - Object keys are sorted lexicographically (UTF-16 code unit order) recursively at all nested levels.
 * - Array ordering is strictly preserved: elements are serialized in their given order; array
 *   contents are NOT reordered (keys are sorted, array elements are not reordered).
 * - Ambiguous and non-finite numeric values (NaN, Infinity, -Infinity, -0) are rejected outright
 *   by throwing a TypeError to prevent silent divergence.
 * - Large chain integers: BigInt values are serialized as decimal strings. Integers outside JS safe
 *   integer range ([-(2^53 - 1), 2^53 - 1]) throw a TypeError to prevent floating-point precision loss.
 * - Compact output: No extraneous whitespace is inserted (no spaces around colons or commas).
 * - Undefined object values are omitted, matching standard JSON behavior.
 * - Circular references throw a TypeError.
 */

export function canonicalJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  function serialize(val: unknown): string {
    if (val === null) {
      return "null";
    }

    if (val === undefined) {
      return "null";
    }

    if (typeof val === "boolean") {
      return val ? "true" : "false";
    }

    if (typeof val === "bigint") {
      // BigInt represented as decimal string per PRD §8
      return JSON.stringify(val.toString(10));
    }

    if (typeof val === "number") {
      if (Number.isNaN(val)) {
        throw new TypeError("Canonical JSON rejects NaN");
      }
      if (!Number.isFinite(val)) {
        throw new TypeError(`Canonical JSON rejects non-finite number: ${val}`);
      }
      if (Object.is(val, -0)) {
        throw new TypeError("Canonical JSON rejects ambiguous -0");
      }
      if (!Number.isSafeInteger(val) && Math.floor(val) === val) {
        throw new TypeError(`Integer ${val} exceeds safe integer range; use a decimal string or BigInt`);
      }
      return JSON.stringify(val);
    }

    if (typeof val === "string") {
      return JSON.stringify(val);
    }

    if (typeof val === "object") {
      // If object has a custom toJSON method (e.g. Date), invoke it first
      if (typeof (val as { toJSON?: () => unknown }).toJSON === "function") {
        return serialize((val as { toJSON: () => unknown }).toJSON());
      }

      if (seen.has(val)) {
        throw new TypeError("Circular reference detected during canonical JSON serialization");
      }
      seen.add(val);

      try {
        if (Array.isArray(val)) {
          // CRITICAL REQUIREMENT (PRD §8):
          // Arrays are serialized in their given order; do not sort array contents.
          // Keys are sorted, array elements are not reordered.
          const elements = val.map((item) => {
            if (item === undefined) {
              return "null";
            }
            return serialize(item);
          });
          return `[${elements.join(",")}]`;
        }

        // Plain object or dictionary
        // Filter out keys with undefined values, then sort lexicographically
        const obj = val as Record<string, unknown>;
        const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
        keys.sort();

        const entries = keys.map((key) => {
          const serializedKey = JSON.stringify(key);
          const serializedVal = serialize(obj[key]);
          return `${serializedKey}:${serializedVal}`;
        });

        return `{${entries.join(",")}}`;
      } finally {
        seen.delete(val);
      }
    }

    throw new TypeError(`Unsupported type for canonical JSON serialization: ${typeof val}`);
  }

  if (value === undefined) {
    throw new TypeError("Canonical JSON cannot serialize undefined top-level value");
  }

  return serialize(value);
}

/**
 * Returns canonical JSON encoded as a UTF-8 Buffer.
 */
export function canonicalJsonBuffer(value: unknown): Buffer {
  return Buffer.from(canonicalJsonStringify(value), "utf8");
}
