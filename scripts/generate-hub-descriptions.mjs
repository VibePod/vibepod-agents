#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentCatalog } from "./check-agent-updates.mjs";
import {
  dockerTagLink,
  markdownTable,
  parseArgs,
  sourceLabel,
} from "./lib/catalog.mjs";

const REPO_URL = "https://github.com/VibePod/vibepod-agents";
const WIKI_URL = `${REPO_URL}/wiki/Container-Versions`;

// Docker Hub rejects short descriptions over 100 characters and full
// descriptions over 25000 bytes.
export const SHORT_DESCRIPTION_LIMIT = 100;
export const FULL_DESCRIPTION_LIMIT = 25000;

// Targets that VibePod starts under a different agent name.
const VIBEPOD_AGENT_NAMES = { devstral: "vibe" };

function imageFor(agent) {
  return `vibepod/${agent.image_name || agent.target}`;
}

export function generateReleasesSection(agent, { limit = 10 } = {}) {
  const releases = (agent.release_history || [])
    .filter((r) => r.image_tag !== "next" && r.image_tag !== "latest")
    .sort((a, b) => (b.released_at || "").localeCompare(a.released_at || ""));

  const historyLink = `Full release history: [Container Versions](${WIKI_URL}#${agent.target}).`;

  if (releases.length === 0) {
    return `## Releases\n\nNo releases recorded yet.\n`;
  }

  const rows = releases
    .slice(0, limit)
    .map((r) => [
      dockerTagLink(agent, r.image_tag || ""),
      r.agent_version || "",
      r.released_at || "",
    ]);

  return `## Releases\n\n${markdownTable(
    ["Image Tag", "Agent Version", "Released At (UTC)"],
    rows,
  )}\n\n${historyLink}\n`;
}

export function renderOverview(agent, body, { releaseLimit = 10 } = {}) {
  const image = imageFor(agent);
  const vibepodAgent = VIBEPOD_AGENT_NAMES[agent.target] || agent.target;
  const platforms = (agent.platforms || []).map((p) => `\`${p}\``).join(", ");

  return [
    `# ${image}\n`,
    `${body.trim()}\n`,
    "## Usage\n",
    "```bash",
    "# with VibePod",
    `vp run ${vibepodAgent}`,
    "",
    "# with plain Docker",
    "docker run -it --rm \\",
    "  -e USER_UID=$(id -u) \\",
    "  -e USER_GID=$(id -g) \\",
    '  -v "$(pwd)":/workspace \\',
    `  ${image}`,
    "```\n",
    "## Platforms\n",
    `${platforms}\n`,
    "## Tags\n",
    "- `latest` is the most recent build.",
    "- `YYYY.MM.N` is an immutable release tag, where `N` counts the releases of this image within the month.\n",
    generateReleasesSection(agent, { limit: releaseLimit }),
    "## Source\n",
    `Built from [\`docker/${agent.target}\`](${REPO_URL}/tree/main/docker/${agent.target}) in [vibepod-agents](${REPO_URL}) and rebuilt when ${sourceLabel(agent)} publishes a new version.\n`,
  ].join("\n");
}

export function processAgent(agent, descriptionsRoot, outputRoot) {
  const agentDir = path.join(descriptionsRoot, agent.target);
  const shortDescPath = path.join(agentDir, "short-description.txt");
  const overviewPath = path.join(agentDir, "overview.md");

  if (!fs.existsSync(shortDescPath) || !fs.existsSync(overviewPath)) {
    throw new Error(`Missing description sources for ${agent.target}`);
  }

  const shortDesc = fs.readFileSync(shortDescPath, "utf8").trim();
  if (shortDesc.length > SHORT_DESCRIPTION_LIMIT) {
    throw new Error(
      `Short description for ${agent.target} has ${shortDesc.length} characters (limit ${SHORT_DESCRIPTION_LIMIT})`,
    );
  }

  const overview = renderOverview(agent, fs.readFileSync(overviewPath, "utf8"));
  if (Buffer.byteLength(overview, "utf8") > FULL_DESCRIPTION_LIMIT) {
    throw new Error(
      `Overview for ${agent.target} exceeds ${FULL_DESCRIPTION_LIMIT} bytes`,
    );
  }

  const outputDir = path.join(outputRoot, agent.target);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "short-description.txt"),
    shortDesc,
    "utf8",
  );
  fs.writeFileSync(path.join(outputDir, "overview.md"), overview, "utf8");
}

function main() {
  const args = parseArgs(process.argv);
  const catalogPath = args.catalog || "wiki/automation/agent-versions.json";
  const definitionsPath = args.definitions || "agents.json";
  const descriptionsRoot = args.descriptions || "descriptions";
  const outputRoot = args.output || "reports/hub-descriptions";

  let agents = loadAgentCatalog(catalogPath, definitionsPath);
  if (args.targets) {
    const targets = new Set(args.targets.split(",").map((t) => t.trim()));
    agents = agents.filter((agent) => targets.has(agent.target));
  }

  for (const agent of agents) {
    processAgent(agent, descriptionsRoot, outputRoot);
    console.log(`generated: ${agent.target}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
