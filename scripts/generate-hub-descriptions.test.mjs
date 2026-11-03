import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FULL_DESCRIPTION_LIMIT,
  generateReleasesSection,
  processAgent,
  renderOverview,
  SHORT_DESCRIPTION_LIMIT,
} from "./generate-hub-descriptions.mjs";
import { readJson } from "./lib/catalog.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const descriptionsRoot = path.join(repoRoot, "descriptions");

function release(tag, version, at) {
  return { image_tag: tag, agent_version: version, released_at: at };
}

const AGENT = {
  target: "codex",
  image_name: "codex",
  platforms: ["linux/amd64", "linux/arm64"],
  automation: { source: { type: "npm", package: "@openai/codex" } },
  release_history: [
    release("2026.01.1", "1.0.0", "2026-01-10T00:00:00Z"),
    release("2026.03.1", "3.0.0", "2026-03-01T00:00:00Z"),
    release("2026.02.1", "2.0.0", "2026-02-01T00:00:00Z"),
  ],
};

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hub-desc-test-"));
}

function writeSources(
  root,
  target,
  { shortDesc = "Short", overview = "Intro.\n" } = {},
) {
  fs.mkdirSync(path.join(root, target), { recursive: true });
  fs.writeFileSync(path.join(root, target, "short-description.txt"), shortDesc);
  fs.writeFileSync(path.join(root, target, "overview.md"), overview);
}

test("generateReleasesSection lists newest releases first and links the full history", () => {
  const section = generateReleasesSection(AGENT);

  assert.ok(section.startsWith("## Releases\n\n"));
  assert.ok(section.indexOf("2026.03.1") < section.indexOf("2026.02.1"));
  assert.ok(section.indexOf("2026.02.1") < section.indexOf("2026.01.1"));
  assert.ok(
    section.includes(
      "https://hub.docker.com/r/vibepod/codex/tags?name=2026.03.1",
    ),
  );
  assert.ok(section.includes("/wiki/Container-Versions#codex"));
});

test("generateReleasesSection caps the table at the release limit", () => {
  const section = generateReleasesSection(AGENT, { limit: 2 });

  assert.ok(section.includes("2026.03.1"));
  assert.ok(section.includes("2026.02.1"));
  assert.ok(!section.includes("2026.01.1"));
});

test("generateReleasesSection skips next and latest pseudo-tags", () => {
  const section = generateReleasesSection({
    ...AGENT,
    release_history: [
      release("next", "9.0.0", "2026-03-20T00:00:00Z"),
      release("latest", "9.0.0", "2026-03-20T00:00:00Z"),
    ],
  });

  assert.equal(section, "## Releases\n\nNo releases recorded yet.\n");
});

test("renderOverview wraps the body with usage, platforms and source", () => {
  const overview = renderOverview(AGENT, "Intro.\n\n## Image\n\n- Feature\n");

  assert.ok(overview.startsWith("# vibepod/codex\n\nIntro."));
  assert.ok(overview.includes("vp run codex"));
  assert.ok(overview.includes("  vibepod/codex\n```"));
  assert.ok(overview.includes("`linux/amd64`, `linux/arm64`"));
  assert.ok(overview.includes("[npm:@openai/codex]"));
  assert.ok(overview.endsWith(".\n"));
});

test("renderOverview uses the VibePod agent name when it differs from the target", () => {
  const overview = renderOverview({ ...AGENT, target: "devstral" }, "Intro.");

  assert.ok(overview.includes("vp run vibe\n"));
});

test("processAgent writes trimmed short description and rendered overview", () => {
  const sources = tmpDir();
  const output = tmpDir();
  writeSources(sources, "codex", { shortDesc: "Short\n" });

  processAgent(AGENT, sources, output);

  assert.equal(
    fs.readFileSync(
      path.join(output, "codex", "short-description.txt"),
      "utf8",
    ),
    "Short",
  );
  const overview = fs.readFileSync(
    path.join(output, "codex", "overview.md"),
    "utf8",
  );
  assert.ok(overview.includes("## Releases"));
});

test("processAgent fails when description sources are missing", () => {
  assert.throws(
    () => processAgent(AGENT, tmpDir(), tmpDir()),
    /Missing description sources for codex/,
  );
});

test("processAgent fails when the short description exceeds the Docker Hub limit", () => {
  const sources = tmpDir();
  writeSources(sources, "codex", {
    shortDesc: "x".repeat(SHORT_DESCRIPTION_LIMIT + 1),
  });

  assert.throws(() => processAgent(AGENT, sources, tmpDir()), /limit 100/);
});

test("every agent in agents.json has Docker Hub descriptions that fit the limits", () => {
  const agents = readJson(path.join(repoRoot, "agents.json")).agents;
  const output = tmpDir();

  for (const agent of agents) {
    const longHistory = Array.from({ length: 500 }, (_, index) =>
      release(`2026.01.${index + 1}`, `v${index}.0.0`, "2026-01-01T00:00:00Z"),
    );
    processAgent(
      { ...agent, release_history: longHistory },
      descriptionsRoot,
      output,
    );

    const overview = fs.readFileSync(
      path.join(output, agent.target, "overview.md"),
    );
    assert.ok(overview.length <= FULL_DESCRIPTION_LIMIT, agent.target);
  }

  const described = fs.readdirSync(descriptionsRoot).sort();
  assert.deepEqual(described, agents.map((agent) => agent.target).sort());
});
