import assert from "node:assert/strict";
import test from "node:test";

import { applyAgentUpdates } from "./apply-agent-updates.mjs";

const generatedAt = "2026-09-30T00:00:00Z";

test("applyAgentUpdates records updates for targets already in wiki state", () => {
  const catalog = {
    agents: [{ target: "codex", tracked: {}, release_history: [] }],
  };

  applyAgentUpdates({
    catalog,
    updates: [
      { target: "codex", agent_version: "1.0.0", image_tag: "2026.09.1" },
    ],
    generatedAt,
  });

  assert.deepEqual(catalog.agents[0].tracked, {
    agent_version: "1.0.0",
    image_tag: "2026.09.1",
    last_updated: generatedAt,
  });
  assert.equal(catalog.agents[0].release_history.length, 1);
});

test("applyAgentUpdates seeds new targets from repository definitions", () => {
  const catalog = { agents: [{ target: "codex", tracked: {} }] };
  const definitions = [
    { target: "codex", image_name: "codex" },
    { target: "cursor", image_name: "cursor", version_build_arg: "CV" },
  ];

  applyAgentUpdates({
    catalog,
    updates: [
      {
        target: "cursor",
        agent_version: "2026.09.01-abc123",
        image_tag: "2026.09.1",
      },
    ],
    definitions,
    generatedAt,
  });

  assert.equal(catalog.agents.length, 2);
  const cursor = catalog.agents[1];
  assert.equal(cursor.target, "cursor");
  assert.equal(cursor.image_name, "cursor");
  assert.equal(cursor.tracked.image_tag, "2026.09.1");
  assert.deepEqual(cursor.release_history, [
    {
      released_at: generatedAt,
      image_tag: "2026.09.1",
      agent_version: "2026.09.01-abc123",
      reason: "automation",
    },
  ]);
  assert.equal(definitions[1].tracked, undefined);
});

test("applyAgentUpdates rejects targets missing from state and definitions", () => {
  assert.throws(
    () =>
      applyAgentUpdates({
        catalog: { agents: [] },
        updates: [{ target: "ghost", agent_version: "1", image_tag: "t" }],
        definitions: [{ target: "cursor" }],
        generatedAt,
      }),
    /Unknown target in updates: ghost/,
  );
});
