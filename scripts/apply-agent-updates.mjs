#!/usr/bin/env node

import fs from "node:fs";
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

function main() {
  const args = parseArgs(process.argv);
  const catalogPath = args.catalog || "agents.json";
  const outputCatalog = args["output-catalog"] || catalogPath;
  const outputPage = args["output-page"] || "wiki/Container-Versions.md";
  const generatedAt = args["generated-at"] || nowUtcIso();

  const updates = ensureArray(normalizeUpdates(args), "updates");
  const catalog = readJson(catalogPath);
  const agents = ensureArray(catalog.agents || [], "catalog.agents");

  const agentByTarget = new Map(agents.map((agent) => [agent.target, agent]));

  for (const update of updates) {
    if (!update?.target) {
      throw new Error("Each update requires a target");
    }

    const agent = agentByTarget.get(update.target);
    if (!agent) {
      throw new Error(`Unknown target in updates: ${update.target}`);
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

  writeJson(outputCatalog, catalog);

  const markdown = renderVersionsMarkdown(catalog, generatedAt);
  fs.writeFileSync(outputPage, markdown, "utf8");

  console.log(`Updated ${updates.length} agent(s).`);
  console.log(`Wrote ${outputCatalog}`);
  console.log(`Wrote ${outputPage}`);
}

main();
