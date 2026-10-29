import assert from "node:assert/strict";
import test from "node:test";
import { settlementBatchSize } from "./settlementBatch";

test("caps each contract settlement tuple at fifty calls", () => {
  assert.equal(settlementBatchSize(1), 1);
  assert.equal(settlementBatchSize(50), 50);
  assert.equal(settlementBatchSize(51), 50);
  assert.equal(settlementBatchSize(120), 50);
});
