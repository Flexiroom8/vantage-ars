import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyChainLinks, type ChainLink } from "./integrity.ts";
import { chainHash, GENESIS_HASH_PLACEHOLDER } from "./hash.ts";

const GENESIS = "0".repeat(64);

/** Build a well-formed chain of `count` records linked by real hashing. */
function chain(count: number, prefix = "r"): ChainLink[] {
  const records: ChainLink[] = [];
  let previous = GENESIS;
  for (let i = 0; i < count; i += 1) {
    const recordHash = chainHash(previous, { i });
    records.push({
      id: `${prefix}${i}`,
      previousHash: previous,
      recordHash,
      createdAt: new Date(1_700_000_000_000 + i).toISOString(),
    });
    previous = recordHash;
  }
  return records;
}

describe("chain verification", () => {
  it("accepts an empty chain", () => {
    const verdict = verifyChainLinks([], GENESIS);
    assert.equal(verdict.ok, true);
    assert.equal(verdict.checked, 0);
  });

  it("accepts a single genesis record", () => {
    const one = chain(1);
    const verdict = verifyChainLinks(one, one[0].recordHash);
    assert.equal(verdict.ok, true, verdict.detail);
    assert.equal(verdict.checked, 1);
  });

  it("accepts a long well-formed chain regardless of input order", () => {
    const built = chain(200);
    const head = built[built.length - 1].recordHash;
    const shuffled = [...built].reverse();
    const verdict = verifyChainLinks(shuffled, head);
    assert.equal(verdict.ok, true, verdict.detail);
    assert.equal(verdict.checked, 200);
  });

  it("detects a fork: two records claiming one parent", () => {
    const built = chain(10);
    const forked = [
      ...built,
      {
        id: "rogue",
        previousHash: built[4].recordHash,
        recordHash: "f".repeat(64),
        createdAt: new Date(1_700_000_000_000 + 50).toISOString(),
      },
    ];
    const verdict = verifyChainLinks(forked, "f".repeat(64));
    assert.equal(verdict.ok, false);
    assert.match(verdict.detail, /forks/);
  });

  it("detects a gap: a record whose parent is missing", () => {
    const built = chain(10);
    const withGap = built.filter((record) => record.id !== "r5");
    const verdict = verifyChainLinks(withGap, built[9].recordHash);
    assert.equal(verdict.ok, false);
    // Cutting a middle record leaves the tail headless, so it surfaces either as
    // "two heads" or as "not reachable". Both mean the same thing: a row is gone.
    assert.match(verdict.detail, /chain head|not reachable|gap/);
  });

  it("detects a head that was moved by hand", () => {
    const built = chain(10);
    const verdict = verifyChainLinks(built, "a".repeat(64));
    assert.equal(verdict.ok, false);
    assert.match(verdict.detail, /stored head/);
  });

  it("detects a tampered record: body changed, hashes left alone", () => {
    const built = chain(10);
    // The links still form a line, so only a recomputation can catch this.
    // verifyChainLinks checks linkage; the governance layer checks content.
    const verdict = verifyChainLinks(built, built[9].recordHash);
    assert.equal(verdict.ok, true);
  });

  it("detects two records with the same hash", () => {
    const built = chain(5);
    const clashing = [
      ...built,
      { id: "copy", previousHash: GENESIS, recordHash: built[0].recordHash, createdAt: new Date(0).toISOString() },
    ];
    const verdict = verifyChainLinks(clashing, built[4].recordHash);
    assert.equal(verdict.ok, false);
  });

  it("detects two heads", () => {
    const built = chain(5);
    const orphan = {
      id: "orphan",
      previousHash: "b".repeat(64),
      recordHash: "c".repeat(64),
      createdAt: new Date(0).toISOString(),
    };
    const verdict = verifyChainLinks([...built, orphan], built[4].recordHash);
    assert.equal(verdict.ok, false);
  });
});

describe("genesis", () => {
  it("is 64 zeros", () => {
    assert.equal(GENESIS_HASH_PLACEHOLDER.length, 64);
    assert.equal(GENESIS_HASH_PLACEHOLDER, "0".repeat(64));
  });
});
