import test from "node:test";
import assert from "node:assert/strict";

import { planAgentUpdates } from "./check-agent-updates.mjs";

const checkedAt = "2026-03-25T00:00:00Z";

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

test("planAgentUpdates skips unchanged latest tags by default", async () => {
  const { updates, statusRows } = await planAgentUpdates({
    agents: [makeAgent()],
    checkedAt,
    forceRecreateLatest: false,
    resolveLatestVersion: async () => ({ supported: true, latestVersion: "v1.2.3" }),
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
    resolveLatestVersion: async () => ({ supported: true, latestVersion: "v1.2.3" }),
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
