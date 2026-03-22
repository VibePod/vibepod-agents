#!/usr/bin/env node
// scripts/generate-hub-descriptions.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readJson,
  parseArgs,
  markdownTable,
  dockerTagLink,
} from "./lib/catalog.mjs";

/**
 * Build the "## Releases" section for a given agent.
 * Exported for unit testing.
 *
 * @param {object} agent  An entry from the catalog agents array.
 * @returns {string}      Markdown section ending with a single newline.
 */
export function generateReleasesSection(agent) {
  const releases = (agent.release_history || [])
    .filter((r) => r.image_tag !== "next" && r.image_tag !== "latest")
    // ISO 8601 strings sort lexicographically — newest first
    .sort((a, b) => (b.released_at || "").localeCompare(a.released_at || ""));

  if (releases.length === 0) {
    return "## Releases\n\nNo releases recorded.\n";
  }

  const rows = releases.map((r) => [
    dockerTagLink(agent, r.image_tag || ""),
    r.agent_version || "",
    r.released_at || "",
  ]);

  return `## Releases\n\n${markdownTable(
    ["Image Tag", "Agent Version", "Released At (UTC)"],
    rows,
  )}\n`;
}

/**
 * Generate output files for a single agent.
 * Exported for unit testing.
 *
 * @param {object} agent             Catalog agent entry.
 * @param {string} descriptionsRoot  Path to the descriptions/ root directory.
 * @param {object} [opts]
 * @param {boolean} [opts.required]  If true, exit non-zero on missing dir (single-agent mode).
 * @returns {boolean}  true on success, false if skipped.
 */
export function processAgent(agent, descriptionsRoot, { required = false } = {}) {
  const agentDir = path.join(descriptionsRoot, agent.target);

  if (!fs.existsSync(agentDir)) {
    if (required) {
      console.error(`error: no descriptions directory for agent "${agent.target}"`);
      process.exit(1);
    }
    console.warn(`warn: no descriptions directory for agent "${agent.target}", skipping`);
    return false;
  }

  const shortDescPath = path.join(agentDir, "short-description.txt");
  const overviewPath = path.join(agentDir, "overview.md");

  if (!fs.existsSync(shortDescPath) || !fs.existsSync(overviewPath)) {
    console.warn(`warn: missing source files for agent "${agent.target}", skipping`);
    return false;
  }

  const shortDesc = fs.readFileSync(shortDescPath, "utf8");
  const overviewBody = fs.readFileSync(overviewPath, "utf8");

  // All reads succeeded — safe to create the output directory now.
  const outputDir = path.join(agentDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  if (shortDesc.trim().length > 100) {
    console.warn(
      `warn: short-description.txt for "${agent.target}" exceeds 100 chars (${shortDesc.trim().length})`,
    );
  }
  fs.writeFileSync(path.join(outputDir, "short-description.txt"), shortDesc, "utf8");
  const releasesSection = generateReleasesSection(agent);
  const finalOverview = `${overviewBody.trimEnd()}\n\n${releasesSection}`;
  fs.writeFileSync(path.join(outputDir, "overview.md"), finalOverview, "utf8");

  console.log(`generated: ${agent.target}`);
  return true;
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.catalog) {
    console.error("error: --catalog is required");
    process.exit(1);
  }
  if (!args.descriptions) {
    console.error("error: --descriptions is required");
    process.exit(1);
  }
  if (args.agent === "true") {
    console.error("error: --agent requires a value");
    process.exit(1);
  }

  const catalog = readJson(args.catalog);
  const agents = catalog.agents || [];

  if (args.agent) {
    const agent = agents.find((a) => a.target === args.agent);
    if (!agent) {
      console.error(`error: agent "${args.agent}" not found in catalog`);
      process.exit(1);
    }
    processAgent(agent, args.descriptions, { required: true });
  } else {
    for (const agent of agents) {
      processAgent(agent, args.descriptions);
    }
  }
}

// Only run when executed directly (not imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
