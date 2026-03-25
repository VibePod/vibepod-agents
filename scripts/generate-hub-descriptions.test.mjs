// scripts/generate-hub-descriptions.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  generateReleasesSection,
  processAgent,
} from "./generate-hub-descriptions.mjs";

// ---------------------------------------------------------------------------
// generateReleasesSection
// ---------------------------------------------------------------------------

test("generateReleasesSection: renders sorted release table", () => {
  const agent = {
    target: "claude",
    image_name: "claude",
    release_history: [
      { image_tag: "2026.01.1", agent_version: "v1.0.0", released_at: "2026-01-10T00:00:00Z" },
      { image_tag: "2026.03.1", agent_version: "v3.0.0", released_at: "2026-03-01T00:00:00Z" },
      { image_tag: "2026.02.1", agent_version: "v2.0.0", released_at: "2026-02-01T00:00:00Z" },
    ],
  };

  const result = generateReleasesSection(agent);

  assert.ok(result.startsWith("## Releases\n\n"), "should start with ## Releases heading");
  // Newest first
  const idx2026_03 = result.indexOf("2026.03.1");
  const idx2026_02 = result.indexOf("2026.02.1");
  const idx2026_01 = result.indexOf("2026.01.1");
  assert.ok(idx2026_03 < idx2026_02, "2026.03.1 should appear before 2026.02.1");
  assert.ok(idx2026_02 < idx2026_01, "2026.02.1 should appear before 2026.01.1");
  assert.ok(result.endsWith("\n"), "should end with newline");
  assert.ok(result.includes("v3.0.0"), "should include agent version");
  assert.ok(
    result.includes("https://hub.docker.com/r/vibepod/claude/tags?name=2026.03.1"),
    "should include Docker Hub link with tag query param",
  );
});

test("generateReleasesSection: excludes next and latest pseudo-tags", () => {
  const agent = {
    target: "claude",
    image_name: "claude",
    release_history: [
      { image_tag: "next", agent_version: "v99.0.0", released_at: "2026-03-20T00:00:00Z" },
      { image_tag: "latest", agent_version: "v99.0.0", released_at: "2026-03-20T00:00:00Z" },
      { image_tag: "2026.03.1", agent_version: "v3.0.0", released_at: "2026-03-01T00:00:00Z" },
    ],
  };

  const result = generateReleasesSection(agent);

  assert.ok(!result.includes(">next<") && !result.includes("[next]"), "should exclude next tag");
  assert.ok(!result.includes(">latest<") && !result.includes("[latest]"), "should exclude latest tag");
  assert.ok(result.includes("2026.03.1"), "should include real release");
});

test("generateReleasesSection: emits empty-state text when no releases", () => {
  const agent = {
    target: "claude",
    image_name: "claude",
    release_history: [
      { image_tag: "next", agent_version: "v99.0.0", released_at: "2026-03-20T00:00:00Z" },
    ],
  };

  const result = generateReleasesSection(agent);

  assert.equal(result, "## Releases\n\nNo releases recorded.\n");
});

test("generateReleasesSection: handles missing release_history", () => {
  const agent = { target: "claude", image_name: "claude" };
  const result = generateReleasesSection(agent);
  assert.equal(result, "## Releases\n\nNo releases recorded.\n");
});

// ---------------------------------------------------------------------------
// processAgent
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hub-desc-test-"));
}

function makeAgentFixture(root, agentName, { shortDesc, overview, omit = [] } = {}) {
  const agentDir = path.join(root, agentName);
  fs.mkdirSync(agentDir, { recursive: true });
  if (!omit.includes("short-description.txt")) {
    fs.writeFileSync(
      path.join(agentDir, "short-description.txt"),
      shortDesc ?? `${agentName} short description`,
      "utf8",
    );
  }
  if (!omit.includes("overview.md")) {
    fs.writeFileSync(
      path.join(agentDir, "overview.md"),
      overview ?? `# ${agentName}\n\nBody text.\n`,
      "utf8",
    );
  }
  return agentDir;
}

const SIMPLE_AGENT = {
  target: "testagent",
  image_name: "testagent",
  release_history: [
    { image_tag: "2026.03.1", agent_version: "v1.0.0", released_at: "2026-03-01T00:00:00Z" },
  ],
};

test("processAgent: writes output files for valid agent", () => {
  const tmp = makeTmpDir();
  makeAgentFixture(tmp, "testagent");

  processAgent(SIMPLE_AGENT, tmp);

  const outputDir = path.join(tmp, "testagent", "output");
  assert.ok(fs.existsSync(path.join(outputDir, "short-description.txt")), "short-description.txt written");
  assert.ok(fs.existsSync(path.join(outputDir, "overview.md")), "overview.md written");

  const overview = fs.readFileSync(path.join(outputDir, "overview.md"), "utf8");
  assert.ok(overview.includes("## Releases"), "overview contains releases section");
  assert.ok(overview.includes("2026.03.1"), "overview contains release tag");
});

test("processAgent: overview ends with single newline", () => {
  const tmp = makeTmpDir();
  makeAgentFixture(tmp, "testagent", { overview: "# testagent\n\nBody.\n" });

  processAgent(SIMPLE_AGENT, tmp);

  const overview = fs.readFileSync(
    path.join(tmp, "testagent", "output", "overview.md"),
    "utf8",
  );
  assert.ok(overview.endsWith("\n"), "ends with newline");
  assert.ok(!overview.endsWith("\n\n"), "does not end with double newline");
});

test("processAgent: warns and returns false when descriptions dir missing (bulk mode)", () => {
  const tmp = makeTmpDir();
  // do NOT create agent dir

  const warnings = [];
  const origWarn = console.warn;
  try {
    console.warn = (msg) => warnings.push(msg);

    const result = processAgent(SIMPLE_AGENT, tmp);

    assert.equal(result, false, "returns false");
    assert.ok(warnings.some(w => w.includes("testagent")), "emits warning mentioning agent name");
    assert.ok(!fs.existsSync(path.join(tmp, "testagent", "output")), "output dir not created");
  } finally {
    console.warn = origWarn;
  }
});

test("processAgent: exits non-zero when descriptions dir missing (required mode)", () => {
  const tmp = makeTmpDir();

  let exitCode;
  const origExit = process.exit;
  process.exit = (code) => { exitCode = code; throw new Error("exit"); };

  try {
    processAgent(SIMPLE_AGENT, tmp, { required: true });
  } catch {
    // swallow the thrown Error("exit")
  } finally {
    process.exit = origExit;
  }

  assert.ok(exitCode !== 0, "exits non-zero");
});

test("processAgent: warns and skips when input files are missing", () => {
  const tmp = makeTmpDir();
  makeAgentFixture(tmp, "testagent", { omit: ["overview.md"] });

  const warnings = [];
  const origWarn = console.warn;
  try {
    console.warn = (msg) => warnings.push(msg);

    const result = processAgent(SIMPLE_AGENT, tmp);

    assert.equal(result, false, "returns false");
    assert.ok(warnings.some(w => w.includes("testagent")), "emits warning");
    assert.ok(!fs.existsSync(path.join(tmp, "testagent", "output")), "output dir not created");
  } finally {
    console.warn = origWarn;
  }
});

test("processAgent: warns when short-description.txt exceeds 100 chars", () => {
  const tmp = makeTmpDir();
  const longDesc = "x".repeat(101);
  makeAgentFixture(tmp, "testagent", { shortDesc: longDesc });

  const warnings = [];
  const origWarn = console.warn;
  try {
    console.warn = (msg) => warnings.push(msg);

    processAgent(SIMPLE_AGENT, tmp);

    assert.ok(warnings.some(w => w.includes("100")), "emits warning mentioning 100");

    // Still writes the file
    assert.ok(
      fs.existsSync(path.join(tmp, "testagent", "output", "short-description.txt")),
      "short-description.txt still written",
    );
  } finally {
    console.warn = origWarn;
  }
});
