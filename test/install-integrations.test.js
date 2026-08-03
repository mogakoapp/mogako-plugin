import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const INTEGRATIONS = [
  {
    name: "Codex",
    file: new URL("../integrations/codex/mogako/SKILL.md", import.meta.url),
    target: "codex"
  },
  {
    name: "Claude Code",
    file: new URL("../integrations/claude-code/skills/mogako/SKILL.md", import.meta.url),
    target: "claude-code"
  },
  {
    name: "Antigravity",
    file: new URL("../integrations/antigravity/mogako/SKILL.md", import.meta.url),
    target: "antigravity"
  }
];

test("supported integrations call only the common checkpoint command", async () => {
  for (const integration of INTEGRATIONS) {
    const content = await fs.readFile(integration.file, "utf8");
    assert.match(
      content,
      new RegExp(
        `mogako checkpoint --summary-file <file> --repo <repository-root> --target ${integration.target} --submit`,
        "u"
      ),
      `${integration.name} must use its common CLI target`
    );
    assert.doesNotMatch(content, /worklog-imports\/checkpoints/u);
    assert.doesNotMatch(content, /Authorization:\s*Worklog/iu);
    assert.doesNotMatch(content, /https?:\/\//iu);
    assert.doesNotMatch(content, /--yes/u);
  }
});

test("integration summary input uses the exact v2 allowlist", async () => {
  for (const integration of INTEGRATIONS) {
    const content = await fs.readFile(integration.file, "utf8");
    assert.match(content, /"summary"/u);
    assert.match(content, /"completed"/u);
    assert.match(content, /"nextActions"/u);
    assert.match(content, /"blockers"/u);
    assert.match(content, /Do not include title/u);
  }
});

test("integrations preserve final preview approval and forbid automatic submit", async () => {
  for (const integration of INTEGRATIONS) {
    const content = await fs.readFile(integration.file, "utf8");
    assert.match(content, /exact wire JSON and destination/u);
    assert.match(content, /final submission approval/u);
    assert.match(content, /Never add automatic, startup, periodic, or session-end/u);
  }
});
