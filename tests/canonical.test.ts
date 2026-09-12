import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalJsonStringify, canonicalJsonBuffer } from "../packages/verification/src/canonical.js";

describe("canonicalJsonStringify", () => {
  it("serializes objects identically regardless of key insertion order", () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { c: 3, b: 2, a: 1 };
    const obj3 = { a: 1, c: 3, b: 2 };

    const s1 = canonicalJsonStringify(obj1);
    const s2 = canonicalJsonStringify(obj2);
    const s3 = canonicalJsonStringify(obj3);

    assert.equal(s1, '{"a":1,"b":2,"c":3}');
    assert.equal(s1, s2);
    assert.equal(s2, s3);
  });

  it("sorts keys recursively at all nested object levels", () => {
    const nested = {
      z: { y: 2, x: 1 },
      a: {
        d: { f: 6, e: 5 },
        c: 3
      }
    };

    const expected = '{"a":{"c":3,"d":{"e":5,"f":6}},"z":{"x":1,"y":2}}';
    assert.equal(canonicalJsonStringify(nested), expected);
  });

  it("strictly preserves array element order while sorting keys within array elements", () => {
    // PRD §8 requirement: keys are sorted, array elements are not reordered
    const input = [
      { z: 1, a: 2 },
      { y: 3, b: 4 },
      "third",
      42,
      { x: 5, c: 6 }
    ];

    const expected = '[{"a":2,"z":1},{"b":4,"y":3},"third",42,{"c":6,"x":5}]';
    assert.equal(canonicalJsonStringify(input), expected);

    // Reversing the array must change the serialized output
    const reversedInput = [...input].reverse();
    assert.notEqual(canonicalJsonStringify(input), canonicalJsonStringify(reversedInput));
  });

  it("rejects non-finite numeric values (NaN, Infinity, -Infinity) and ambiguous -0 with TypeError", () => {
    // Documented policy: reject ambiguous / non-finite values outright
    assert.throws(
      () => canonicalJsonStringify({ val: NaN }),
      { name: "TypeError", message: /Canonical JSON rejects NaN/ }
    );

    assert.throws(
      () => canonicalJsonStringify({ val: Infinity }),
      { name: "TypeError", message: /Canonical JSON rejects non-finite number/ }
    );

    assert.throws(
      () => canonicalJsonStringify({ val: -Infinity }),
      { name: "TypeError", message: /Canonical JSON rejects non-finite number/ }
    );

    assert.throws(
      () => canonicalJsonStringify({ val: -0 }),
      { name: "TypeError", message: /Canonical JSON rejects ambiguous -0/ }
    );
  });

  it("serializes large chain integers (BigInt) as decimal strings per PRD §8", () => {
    const largeInt = 115792089237316195423570985008687907853269984665640564039457584007913129639935n; // 2^256 - 1
    const payload = {
      chainId: 1,
      weiAmount: largeInt
    };

    const serialized = canonicalJsonStringify(payload);
    assert.equal(
      serialized,
      '{"chainId":1,"weiAmount":"115792089237316195423570985008687907853269984665640564039457584007913129639935"}'
    );

    // Integers beyond safe integer range as numbers are rejected to prevent precision loss
    assert.throws(
      () => canonicalJsonStringify({ unsafe: 9007199254740992 }),
      { name: "TypeError", message: /exceeds safe integer range/ }
    );
  });

  it("omits undefined object properties and converts undefined in arrays to null", () => {
    const objWithUndefined = {
      a: 1,
      b: undefined,
      c: "hello",
      arr: [1, undefined, 3]
    };

    assert.equal(
      canonicalJsonStringify(objWithUndefined),
      '{"a":1,"arr":[1,null,3],"c":"hello"}'
    );
  });

  it("detects circular references and throws TypeError", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    assert.throws(
      () => canonicalJsonStringify(circular),
      { name: "TypeError", message: /Circular reference detected/ }
    );
  });

  it("returns a UTF-8 Buffer matching canonicalJsonStringify", () => {
    const obj = { name: "Signal §7 — Passport" };
    const buf = canonicalJsonBuffer(obj);
    const str = canonicalJsonStringify(obj);

    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.toString("utf8"), str);
  });
});
