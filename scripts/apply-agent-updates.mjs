#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nowUtcIso,
  parseArgs,
  readJson,
  renderVersionsMarkdown,
  writeJson,
} from "./lib/catalog.mjs";

function normalizeUpdates(args) {
  const normalize = (value) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === "object" && Array.isArray(value.updates)) {
      return value.updates;
    }
    return value;
  };

  if (args["updates-file"]) {
    return normalize(readJson(args["updates-file"]));
  }

  if (args["updates-json"]) {
    return normalize(JSON.parse(args["updates-json"]));
  }

  return [];
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function upsertReleaseHistory(agent, releaseEntry) {
  if (!Array.isArray(agent.release_history)) {
    agent.release_history = [];
  }

  agent.release_history.push(releaseEntry);
  agent.release_history.sort((left, right) =>
    (right.released_at || "").localeCompare(left.released_at || ""),
  );
}

export function applyAgentUpdates({
  catalog,
  updates,
  definitions = [],
  generatedAt,
}) {
  const agents = ensureArray(catalog.agents || [], "catalog.agents");
  catalog.agents = agents;

  const agentByTarget = new Map(agents.map((agent) => [agent.target, agent]));
  const definitionByTarget = new Map(
    definitions.map((definition) => [definition.target, definition]),
  );

  for (const update of updates) {
    if (!update?.target) {
      throw new Error("Each update requires a target");
    }

    let agent = agentByTarget.get(update.target);
    if (!agent) {
      // A target newly added to agents.json has no wiki state yet; seed it
      // from the repository definition so its first release is recorded.
      const definition = definitionByTarget.get(update.target);
      if (!definition) {
        throw new Error(`Unknown target in updates: ${update.target}`);
      }
      agent = { ...definition, tracked: {}, release_history: [] };
      agents.push(agent);
      agentByTarget.set(update.target, agent);
    }

    if (!agent.tracked || typeof agent.tracked !== "object") {
      agent.tracked = {};
    }

    const releasedAt = update.released_at || generatedAt;

    agent.tracked.agent_version = update.agent_version;
    agent.tracked.image_tag = update.image_tag;
    agent.tracked.last_updated = releasedAt;

    upsertReleaseHistory(agent, {
      released_at: releasedAt,
      image_tag: update.image_tag,
      agent_version: update.agent_version,
      reason: update.reason || "automation",
    });
  }

  return catalog;
}

function main() {
  const args = parseArgs(process.argv);
  const catalogPath = args.catalog || "agents.json";
  const outputCatalog = args["output-catalog"] || catalogPath;
  const outputPage = args["output-page"] || "wiki/Container-Versions.md";
  const generatedAt = args["generated-at"] || nowUtcIso();

  const updates = ensureArray(normalizeUpdates(args), "updates");
  const catalog = readJson(catalogPath);
  const definitions = args.definitions
    ? ensureArray(readJson(args.definitions).agents || [], "definitions.agents")
    : [];

  applyAgentUpdates({ catalog, updates, definitions, generatedAt });

  writeJson(outputCatalog, catalog);

  const markdown = renderVersionsMarkdown(catalog, generatedAt);
  fs.writeFileSync(outputPage, markdown, "utf8");

  console.log(`Updated ${updates.length} agent(s).`);
  console.log(`Wrote ${outputCatalog}`);
  console.log(`Wrote ${outputPage}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentScriptPath = fileURLToPath(import.meta.url);

if (invokedPath === currentScriptPath) {
  main();
}
