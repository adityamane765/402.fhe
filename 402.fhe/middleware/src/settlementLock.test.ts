import assert from "node:assert/strict";
import test from "node:test";
import { SettlementLock } from "./settlementLock";

test("rejects an overlapping settlement until the first releases", () => {
  const lock = new SettlementLock();

  assert.equal(lock.tryAcquire(["buyer:1", "buyer:2"]), true);
  assert.equal(lock.tryAcquire(["buyer:2"]), false);

  lock.release(["buyer:1", "buyer:2"]);
  assert.equal(lock.tryAcquire(["buyer:2"]), true);
});

test("does not partially acquire a rejected key set", () => {
  const lock = new SettlementLock();
  lock.tryAcquire(["buyer:1"]);

  assert.equal(lock.tryAcquire(["buyer:2", "buyer:1"]), false);
  assert.equal(lock.tryAcquire(["buyer:2"]), true);
});
