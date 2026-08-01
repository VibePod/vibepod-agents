import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  fetchLatestVersion,
  loadAgentCatalog,
  mergeAgentDefinitions,
  planAgentUpdates,
} from "./check-agent-updates.mjs";

const checkedAt = "2026-03-25T00:00:00Z";

test("repository definitions supply version build args while wiki supplies release state", async () => {
  const definitions = [
    {
      target: "jcode",
      image_name: "jcode",
      docker_context: "docker/jcode",
      dockerfile: "docker/jcode/Dockerfile",
      platforms: ["linux/amd64", "linux/arm64"],
      version_build_arg: "JCODE_VERSION",
      automation: {
        enabled: true,
        source: { type: "github_release", repo: "1jehuang/jcode" },
      },
    },
  ];
  const wikiAgents = [
    {
      target: "jcode",
      tracked: {
        agent_version: "v0.61.1",
        image_tag: "2026.07.1",
      },
      release_history: [
        {
          agent_version: "v0.61.1",
          image_tag: "2026.07.1",
          released_at: "2026-07-29T22:14:30Z",
        },
      ],
    },
  ];

  const agents = mergeAgentDefinitions(definitions, wikiAgents);
  const { updates } = await planAgentUpdates({
    agents,
    checkedAt,
    resolveLatestVersion: async () => ({
      supported: true,
      latestVersion: "v0.64.2",
    }),
    checkLatestTagExists: async () => true,
  });

  assert.deepEqual(agents[0].tracked, wikiAgents[0].tracked);
  assert.deepEqual(agents[0].release_history, wikiAgents[0].release_history);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].build_args, "JCODE_VERSION=v0.64.2");
});

function makeAgent() {
  return {
    target: "codex",
    image_name: "codex",
    docker_context: "docker/codex",
    dockerfile: "docker/codex/Dockerfile",
    platforms: ["linux/amd64"],
    build_args: { CODEX_CHANNEL: "stable" },
    tracked: {
      agent_version: "v1.2.3",
      image_tag: "2026.03.1",
    },
    automation: {
      enabled: true,
      source: {
        type: "npm",
        package: "@openai/codex",
      },
    },
  };
}

test("mergeAgentDefinitions rejects wiki targets missing from agents.json", () => {
  assert.throws(
    () =>
      mergeAgentDefinitions(
        [{ target: "jcode" }],
        [{ target: "jcode" }, { target: "removed-agent" }],
      ),
    /Wiki state contains target missing from agents.json: removed-agent/,
  );
});

test("loadAgentCatalog combines repository definitions with wiki state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-catalog-"));
  const definitionsPath = join(directory, "agents.json");
  const statePath = join(directory, "state.json");

  try {
    await writeFile(
      definitionsPath,
      JSON.stringify({
        agents: [
          {
            target: "jcode",
            version_build_arg: "JCODE_VERSION",
          },
        ],
      }),
    );
    await writeFile(
      statePath,
      JSON.stringify({
        agents: [
          {
            target: "jcode",
            tracked: { agent_version: "v0.61.1" },
          },
        ],
      }),
    );

    const agents = loadAgentCatalog(statePath, definitionsPath);

    assert.equal(agents[0].version_build_arg, "JCODE_VERSION");
    assert.equal(agents[0].tracked.agent_version, "v0.61.1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("auto-release passes repository definitions to update detection", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/auto-release.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    workflow,
    /--catalog wiki\/automation\/agent-versions\.json\s+--definitions agents\.json/,
  );
});

test("planAgentUpdates skips unchanged latest tags by default", async () => {
  const { updates, statusRows } = await planAgentUpdates({
    agents: [makeAgent()],
    checkedAt,
    forceRecreateLatest: false,
    resolveLatestVersion: async () => ({
      supported: true,
      latestVersion: "v1.2.3",
    }),
    checkLatestTagExists: async () => true,
  });

  assert.equal(updates.length, 0);
  assert.equal(statusRows.length, 1);
  assert.equal(statusRows[0].result, "no-change");
});

test("planAgentUpdates creates an update when forceRecreateLatest is enabled", async () => {
  const { updates, statusRows } = await planAgentUpdates({
    agents: [makeAgent()],
    checkedAt,
    forceRecreateLatest: true,
    resolveLatestVersion: async () => ({
      supported: true,
      latestVersion: "v1.2.3",
    }),
    checkLatestTagExists: async () => true,
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].target, "codex");
  assert.equal(updates[0].agent_version, "v1.2.3");
  assert.equal(updates[0].image_tag, "2026.03.2");
  assert.equal(updates[0].reason, "Manual force recreate of latest image");
  assert.equal(statusRows.length, 1);
  assert.equal(statusRows[0].result, "force-recreate -> 2026.03.2");
});

function makePypiAgent() {
  return {
    target: "tau",
    image_name: "tau",
    docker_context: "docker/tau",
    dockerfile: "docker/tau/Dockerfile",
    platforms: ["linux/amd64", "linux/arm64"],
    version_build_arg: "TAU_VERSION",
    tracked: {
      agent_version: "0.3.3",
      image_tag: "2026.03.1",
    },
    automation: {
      enabled: true,
      source: {
        type: "pypi",
        package: "tau-ai",
      },
    },
  };
}

test("planAgentUpdates labels pypi sources", async () => {
  const { updates, statusRows } = await planAgentUpdates({
    agents: [makePypiAgent()],
    checkedAt,
    resolveLatestVersion: async () => ({
      supported: true,
      latestVersion: "0.4.0",
    }),
    checkLatestTagExists: async () => true,
  });

  assert.equal(statusRows[0].source, "pypi:tau-ai");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].agent_version, "0.4.0");
  assert.equal(updates[0].previous_agent_version, "0.3.3");
  assert.equal(updates[0].build_args, "TAU_VERSION=0.4.0");
  assert.equal(updates[0].reason, "Upstream pypi:tau-ai updated");
});

test("fetchLatestVersion reads the version from the PyPI JSON API", async () => {
  const requested = [];
  const fakeFetch = async (url, options) => {
    requested.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ info: { version: "0.4.0" } }),
    };
  };

  const resolved = await fetchLatestVersion(
    { type: "pypi", package: "tau-ai" },
    fakeFetch,
  );

  assert.deepEqual(resolved, { supported: true, latestVersion: "0.4.0" });
  assert.equal(requested.length, 1);
  assert.equal(requested[0].url, "https://pypi.org/pypi/tau-ai/json");
});

test("fetchLatestVersion fails loudly for pypi errors", async () => {
  await assert.rejects(
    fetchLatestVersion({ type: "pypi" }, async () => {
      throw new Error("should not be called");
    }),
    /Missing pypi package/,
  );

  await assert.rejects(
    fetchLatestVersion({ type: "pypi", package: "tau-ai" }, async () => ({
      ok: false,
      status: 404,
    })),
    /Failed to fetch tau-ai from PyPI \(404\)/,
  );

  await assert.rejects(
    fetchLatestVersion({ type: "pypi", package: "tau-ai" }, async () => ({
      ok: true,
      status: 200,
      json: async () => ({ info: {} }),
    })),
    /PyPI response missing version for tau-ai/,
  );
});
