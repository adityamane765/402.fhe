import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

test("guide exposes a complete GitBook-style documentation map", () => {
  const source = readFileSync(join(here, "page.tsx"), "utf8");
  for (const label of ["Introduction", "Quickstarts", "Agent integrations", "Guides", "Reference", "Help"]) {
    assert.match(source, new RegExp(label, "i"));
  }
  assert.match(source, /Documentation sections/);
  assert.match(source, /mcpConfig/);
  assert.match(source, /callerExample/);
  assert.doesNotMatch(source, /private_key=key/);
  assert.doesNotMatch(source, /key=\{cell\}/);
});

test("API surface document covers every application flow", () => {
  const api = readFileSync(join(here, "../../../../../../docs/api-surface.md"), "utf8");
  for (const flow of ["Marketplace", "Caller", "Provider", "Settlement", "MCP"]) {
    assert.match(api, new RegExp(flow, "i"));
  }
});

