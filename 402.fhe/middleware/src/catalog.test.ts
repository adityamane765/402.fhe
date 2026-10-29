import assert from "node:assert/strict";
import test from "node:test";
import { toPublicApi } from "./catalog";

test("builds public discovery data without exposing the upstream", () => {
  const result = toPublicApi(7, { path: "/api/research", endpoint: "https://secret.example" }, {
    merchant: "0x1234",
    name: "Research",
    description: "Structured data",
    price: 2_000_000n,
    active: true,
  });

  assert.deepEqual(result, {
    apiId: "7",
    name: "Research",
    description: "Structured data",
    price: { amount: "2000000", asset: "USDC", decimals: 6 },
    merchant: "0x1234",
    path: "/api/research",
    available: true,
  });
  assert.equal("endpoint" in result, false);
});
