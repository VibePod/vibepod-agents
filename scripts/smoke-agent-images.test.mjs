import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function readComposeServices() {
  const compose = await readFile(join(repoRoot, "compose.yml"), "utf8");
  return [...compose.matchAll(/^ {2}([a-z0-9_-]+):$/gm)]
    .map((match) => match[1])
    .sort();
}

async function readCatalogTargets() {
  const catalog = JSON.parse(
    await readFile(join(repoRoot, "agents.json"), "utf8"),
  );
  return (catalog.agents || []).map((agent) => agent.target).sort();
}

function runSmoke(args, env = {}) {
  return spawnSync(
    process.execPath,
    ["scripts/smoke-agent-images.mjs", ...args],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: "utf8",
    },
  );
}

test("agent catalog lists every compose image target", async () => {
  assert.deepEqual(await readCatalogTargets(), await readComposeServices());
});

test("Tau Dockerfile pins a fallback version for direct builds", async () => {
  const dockerfile = await readFile(
    join(repoRoot, "docker/tau/Dockerfile"),
    "utf8",
  );

  assert.match(dockerfile, /^ARG TAU_VERSION=\d+\.\d+\.\d+$/m);
  assert.match(dockerfile, /uv tool install "tau-ai==\$\{TAU_VERSION\}"/);
});

test("smoke runner skips cleanly when Docker is unavailable", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "vibepod-agents-smoke-"));
  try {
    const result = runSmoke(["--targets", "claude", "--skip-build"], {
      PATH: tempDir,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SKIP: Docker is not available/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("smoke runner identifies the failing agent image and step", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "vibepod-agents-smoke-"));
  const dockerLog = join(tempDir, "docker.log");
  const dockerPath = join(tempDir, "docker");

  await writeFile(
    dockerPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "--version" ]; then
  echo "Docker version 25.0.0"
  exit 0
fi
if [ "$1" = "info" ]; then
  exit 0
fi
if [ "$1" = "run" ]; then
  echo "simulated smoke failure" >&2
  exit 42
fi
exit 0
`,
    "utf8",
  );
  await chmod(dockerPath, 0o755);

  try {
    const result = runSmoke(["--targets", "codex", "--skip-build"], {
      DOCKER_LOG: dockerLog,
      PATH: `${tempDir}:${process.env.PATH}`,
    });
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1);
    assert.match(output, /\[codex\] run failed/);
    assert.match(output, /vibepod\/codex:latest/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
