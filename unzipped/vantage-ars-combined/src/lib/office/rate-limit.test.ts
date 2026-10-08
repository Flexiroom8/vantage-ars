import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { durableAllow, type SqlLike } from "./rate-limit.ts";

function fakeSql(): SqlLike {
  const counts = new Map<string, number>();
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("insert into rate_hits")) {
      const id = `${values[0]}|${values[1]}|${values[2]}`;
      const next = (counts.get(id) ?? 0) + 1;
      counts.set(id, next);
      return [{ hits: next }];
    }
    return [];
  }) as unknown as SqlLike;
}

describe("durableAllow", () => {
  it("allows up to the limit then refuses inside one window", async () => {
    const sql = fakeSql();
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await durableAllow(sql, "enquiry", "1.2.3.4", 3, 1000, 100));
    assert.deepEqual(results, [true, true, true, false]);
  });
  it("counts callers and buckets separately", async () => {
    const sql = fakeSql();
    assert.equal(await durableAllow(sql, "enquiry", "a", 1, 1000, 0), true);
    assert.equal(await durableAllow(sql, "enquiry", "b", 1, 1000, 0), true);
    assert.equal(await durableAllow(sql, "chat", "a", 1, 1000, 0), true);
    assert.equal(await durableAllow(sql, "enquiry", "a", 1, 1000, 0), false);
  });
  it("starts fresh in the next window", async () => {
    const sql = fakeSql();
    assert.equal(await durableAllow(sql, "x", "a", 1, 1000, 10), true);
    assert.equal(await durableAllow(sql, "x", "a", 1, 1000, 20), false);
    assert.equal(await durableAllow(sql, "x", "a", 1, 1000, 1500), true);
  });
  it("fails open when the database errors", async () => {
    const broken = (async () => {
      throw new Error("db down");
    }) as unknown as SqlLike;
    assert.equal(await durableAllow(broken, "x", "a", 1, 1000, 0), true);
  });
});
