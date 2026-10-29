import assert from "node:assert/strict";
import test from "node:test";
import { ChallengeStore } from "./challengeStore";

test("accepts a matching challenge exactly once", () => {
  const store = new ChallengeStore(1_000, () => 100);
  store.remember("0xabc", 3);

  assert.equal(store.consume("0xabc", 3), true);
  assert.equal(store.consume("0xabc", 3), false);
});

test("rejects a challenge signed for another API", () => {
  const store = new ChallengeStore(1_000, () => 100);
  store.remember("0xabc", 3);

  assert.equal(store.consume("0xabc", 4), false);
});

test("rejects an expired challenge", () => {
  let now = 100;
  const store = new ChallengeStore(1_000, () => now);
  store.remember("0xabc", 3);
  now = 1_101;

  assert.equal(store.consume("0xabc", 3), false);
});

test("bounds stored challenges by evicting the oldest", () => {
  const store = new ChallengeStore(1_000, () => 100, 2);
  store.remember("oldest", 1);
  store.remember("middle", 1);
  store.remember("newest", 1);

  assert.equal(store.consume("oldest", 1), false);
  assert.equal(store.consume("middle", 1), true);
  assert.equal(store.consume("newest", 1), true);
});
