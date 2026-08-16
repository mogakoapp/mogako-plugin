import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (name) => fs.readFile(path.join(root, name), "utf8");

test("public README translations use the official repository and install flow", async () => {
  const names = ["README.md", "README.en.md", "README.ja.md"];
  const contents = await Promise.all(names.map(read));
  for (const content of contents) {
    assert.match(content, /https:\/\/github\.com\/mogakoapp\/mogako-plugin(?:\.git)?/u);
    assert.match(content, /npm ci/u);
    assert.match(content, /npm install -g \./u);
    assert.match(content, /mogako connect/u);
    assert.match(content, /mogako install --target/u);
    assert.doesNotMatch(content, /rbxo0128\/mogako-plugin|mogako\.app/iu);
  }
});

test("public docs distinguish v2 checkpoint fields from legacy v1 fields", async () => {
  const privacy = await read("PRIVACY.md");
  const providerSupport = await read("docs/provider-support.md");
  assert.match(privacy, /v2|checkpoint/iu);
  assert.match(privacy, /title/iu);
  assert.match(privacy, /automatic upload|automatic submission/iu);
  for (const target of ["codex", "claude-code", "antigravity", "antigravity-cli"]) {
    assert.match(providerSupport, new RegExp(target, "u"));
  }
});

test("translated READMEs are shipped with the package", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  for (const name of ["README.md", "README.en.md", "README.ja.md"]) {
    assert.ok(packageJson.files.includes(name));
  }
});
