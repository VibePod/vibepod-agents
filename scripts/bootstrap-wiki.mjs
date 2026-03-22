#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, readJson, renderVersionsMarkdown, writeJson } from "./lib/catalog.mjs";

const MUTABLE_ALIASES = new Set(["latest", "next", "stable", "beta", "alpha", "edge", "main"]);

function isVersionedTag(tag) {
  if (!tag) return false;
  // YYYY.MM.N
  if (/^\d{4}\.\d{2}\.\d+$/.test(tag)) return true;
  // semver
  if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(tag)) return true;
  return false;
}

function isAliasTag(tag) {
  return MUTABLE_ALIASES.has(tag || "");
}

function normalizeIso(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeAgentVersion(target, rawOutput) {
  const lines = `${rawOutput || ""}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  let version = "";
  for (const line of lines) {
    const m = line.match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
    if (m) { version = m[1]; break; }
  }
  if (!version) return "";
  if (target === "claude" || target === "devstral") {
    return `v${version}`;
  }
  return version;
}

async function fetchTagsForAgent(namespace, imageName) {
  const tags = [];
  let nextUrl = `https://hub.docker.com/v2/repositories/${namespace}/${imageName}/tags?page_size=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "vibepod-bootstrap-wiki",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Docker Hub API error for ${namespace}/${imageName}: HTTP ${response.status}`,
      );
    }

    const payload = await response.json();
    for (const item of payload.results || []) {
      tags.push({
        name: item.name,
        pushed_at: normalizeIso(item.tag_last_pushed || item.last_updated || ""),
      });
    }
    nextUrl = payload.next || null;
  }

  return tags;
}

function selectTagsForAgent(fetchedTags) {
  const versioned = fetchedTags
    .filter((t) => isVersionedTag(t.name))
    .sort((a, b) => (b.pushed_at || "").localeCompare(a.pushed_at || ""));

  if (versioned.length > 0) return { selected: versioned, usingFallback: false };

  // Fallback: non-latest alias tags (e.g. "next") when no versioned tags exist
  const aliases = fetchedTags
    .filter((t) => t.name !== "latest" && isAliasTag(t.name))
    .sort((a, b) => (b.pushed_at || "").localeCompare(a.pushed_at || ""));

  return { selected: aliases, usingFallback: true };
}

function pullImageIfNeeded(image, pullMode) {
  if (pullMode === "never") return true; // assume present
  if (pullMode === "always") {
    try {
      execSync(`docker pull ${image}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
  // if-missing
  try {
    execSync(`docker image inspect ${image}`, { stdio: "ignore" });
    return true; // already present
  } catch {
    // not present, pull it
    try {
      execSync(`docker pull ${image}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}

function inspectImageVersion(target, imageName, tag, versionCommand, namespace, pullMode) {
  const image = `${namespace}/${imageName}:${tag}`;

  const pulled = pullImageIfNeeded(image, pullMode);
  if (!pulled) {
    console.log(`    [pull failed] ${image}`);
    return "unknown";
  }

  try {
    const output = execSync(
      `docker run --rm --entrypoint /bin/sh ${image} -c ${JSON.stringify(versionCommand)}`,
      { stdio: "pipe", timeout: 30000 },
    ).toString();

    const version = normalizeAgentVersion(target, output);
    if (!version) {
      console.log(`    [no version detected] ${image}: ${output.trim().slice(0, 80)}`);
      return "unknown";
    }
    return version;
  } catch (err) {
    const output = err.stdout ? err.stdout.toString() : "";
    const version = normalizeAgentVersion(target, output);
    if (version) return version;
    console.log(`    [run failed] ${image}`);
    return "unknown";
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const wikiPath = args.wiki || "wiki";
  const catalogPath = args.catalog || "agents.json";
  const namespace = args.namespace || "vibepod";
  const skipInspect = args["skip-inspect"] === "true" || "skip-inspect" in args;
  const allTags = args["all-tags"] === "true" || "all-tags" in args;
  const pullMode = args.pull || "if-missing";

  if (!["always", "if-missing", "never"].includes(pullMode)) {
    console.error(`Invalid --pull mode: ${pullMode} (expected always|if-missing|never)`);
    process.exit(1);
  }

  if (!skipInspect) {
    try {
      execSync("docker --version", { stdio: "ignore" });
    } catch {
      console.error(
        "docker is required for version inspection. Use --skip-inspect to skip.",
      );
      process.exit(1);
    }
  }

  const catalog = readJson(catalogPath);
  const agents = catalog.agents || [];
  console.log(`Loaded ${agents.length} agent(s) from ${catalogPath}`);

  // Phase 2: fetch Docker Hub tags for all agents
  console.log(`Fetching Docker Hub tags for ${agents.length} agent(s)...`);
  const agentTagData = [];
  for (const agent of agents) {
    const imageName = agent.image_name || agent.target;
    console.log(`  Fetching ${namespace}/${imageName}...`);
    const allFetchedTags = await fetchTagsForAgent(namespace, imageName);
    const { selected, usingFallback } = selectTagsForAgent(allFetchedTags);
    if (selected.length === 0) {
      console.warn(`    [warning] No tags found for ${namespace}/${imageName} — agent will have empty history`);
    } else {
      console.log(
        `    ${selected.length} tag(s)${usingFallback ? " (alias fallback)" : ""}`,
      );
    }
    agentTagData.push({ agent, selected, usingFallback });
  }

  // Phase 3: inspect image versions (optional)
  if (!skipInspect) {
    console.log("Inspecting image versions...");
  }
  // Build a map: "target::tag" -> resolved agent_version
  const resolvedVersions = new Map();

  if (!skipInspect) {
    for (const { agent, selected } of agentTagData) {
      const target = agent.target;
      const imageName = agent.image_name || target;
      const versionCommand = agent.version_command || `${target} --version`;

      const tagsToInspect = allTags
        ? selected
        : selected.slice(0, 1); // default: tracked tag only (most recent)

      for (const tag of tagsToInspect) {
        process.stdout.write(`  Inspecting ${namespace}/${imageName}:${tag.name}... `);
        const version = inspectImageVersion(
          target,
          imageName,
          tag.name,
          versionCommand,
          namespace,
          pullMode,
        );
        console.log(version);
        resolvedVersions.set(`${target}::${tag.name}`, version);
      }
    }
  }

  // Phase 4: build wiki catalog
  console.log("Building wiki catalog...");
  const wikiAgents = agentTagData.map(({ agent, selected }) => {
    const target = agent.target;

    // Build release_history
    const releaseHistory = selected.map((tag) => {
      const key = `${target}::${tag.name}`;
      const agentVersion = resolvedVersions.get(key) || "unknown";
      return {
        released_at: tag.pushed_at || "",
        image_tag: tag.name,
        agent_version: agentVersion,
        reason: "imported-from-dockerhub",
      };
    });

    // Sort descending by released_at
    releaseHistory.sort((a, b) => (b.released_at || "").localeCompare(a.released_at || ""));

    // Determine tracked: most recent selected tag
    const trackedTag = selected[0] || null;
    const trackedVersion = trackedTag
      ? resolvedVersions.get(`${target}::${trackedTag.name}`) || "unknown"
      : "unknown";

    const tracked = trackedTag
      ? {
          agent_version: trackedVersion,
          image_tag: trackedTag.name,
          last_updated: trackedTag.pushed_at || "",
        }
      : agent.tracked || {};

    return {
      ...agent,
      tracked,
      release_history: releaseHistory,
    };
  });

  const wikiCatalog = {
    ...catalog,
    agents: wikiAgents,
  };

  // Phase 5: write output
  const wikiAutomationDir = path.join(wikiPath, "automation");
  fs.mkdirSync(wikiAutomationDir, { recursive: true });

  const wikiCatalogPath = path.join(wikiAutomationDir, "agent-versions.json");
  const wikiPagePath = path.join(wikiPath, "Container-Versions.md");

  writeJson(wikiCatalogPath, wikiCatalog);
  console.log(`Wrote ${wikiCatalogPath}`);

  const markdown = renderVersionsMarkdown(wikiCatalog);
  fs.writeFileSync(wikiPagePath, markdown, "utf8");
  console.log(`Wrote ${wikiPagePath}`);

  console.log("Bootstrap complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
