import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

test("developer page exposes the portfolio-critical journeys", () => {
  const page = readFileSync(join(here, "page.tsx"), "utf8");
  const content = readFileSync(join(here, "content.ts"), "utf8");

  for (const section of [
    "Call a paid API",
    "Expose four tools to an agent",
    "Meter a JSON endpoint",
    "From challenge to channel settlement",
    "Troubleshooting",
    "Current implementation limits",
  ]) {
    assert.match(page + content, new RegExp(section, "i"));
  }
});

test("MCP integration is presented as runnable without production claims", () => {
  const page = readFileSync(join(here, "page.tsx"), "utf8");
  const content = readFileSync(join(here, "content.ts"), "utf8");
  const source = page + content;

  assert.match(source, /mcp_server\.py/i);
  assert.match(source, /MAX_CALL_PRICE_USDC/);
  assert.match(source, /dedicated wallet/i);
  assert.match(source, /bilateral settlement/i);
  assert.match(source, /buyer and API channel/i);
  assert.match(source, /buyer and API pair/i);
  assert.doesNotMatch(source, /mock preview/i);
  assert.doesNotMatch(source, /video placeholder/i);
  assert.doesNotMatch(source, /first result/i);
  assert.doesNotMatch(source, /[—–]/);
  assert.doesNotMatch(source, /production[- ]ready/i);
});

