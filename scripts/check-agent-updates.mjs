#!/usr/bin/env node

import fs from "node:fs";
import {
  nextImageTag,
  nowUtcIso,
  parseArgs,
  readJson,
  writeGithubOutput,
  writeJson,
} from "./lib/catalog.mjs";

function sourceLabel(source) {
  if (!source) return "unknown";
  if (source.type === "npm") return `npm:${source.package}`;
  if (source.type === "github_release") return `github:${source.repo}`;
  if (source.type === "manual") return "manual";
  return source.type || "unknown";
}

async function fetchLatestVersion(source) {
  if (!source || source.type === "manual") {
    return { supported: false, latestVersion: null };
  }

  if (source.type === "npm") {
    if (!source.package) {
      throw new Error("Missing npm package in source config");
    }

    const encoded = encodeURIComponent(source.package);
    const url = `https://registry.npmjs.org/${encoded}/latest`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "vibepod-agents-auto-release",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${source.package} from npm (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.version) {
      throw new Error(`npm response missing version for ${source.package}`);
    }

    return {
      supported: true,
      latestVersion: payload.version,
    };
  }

  if (source.type === "github_release") {
    if (!source.repo) {
      throw new Error("Missing GitHub repository in source config");
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "vibepod-agents-auto-release",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${source.repo}/releases/latest`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch latest GitHub release for ${source.repo} (${response.status})`,
      );
    }

    const payload = await response.json();
    if (!payload.tag_name) {
      throw new Error(`GitHub release response missing tag_name for ${source.repo}`);
    }

    return {
      supported: true,
      latestVersion: payload.tag_name,
    };
  }

  throw new Error(`Unsupported automation source type: ${source.type}`);
}

async function fetchLatestTagExists(imageName, namespace = "vibepod") {
  const url = `https://hub.docker.com/v2/repositories/${namespace}/${imageName}/tags/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "vibepod-agents-auto-release",
    },
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to check latest tag for ${namespace}/${imageName} (${response.status})`,
    );
  }

  return true;
}

function formatBuildArgs(buildArgs) {
  if (!buildArgs || typeof buildArgs !== "object") {
    return "";
  }

  return Object.entries(buildArgs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function appendSummary(summaryPath, report, statusRows) {
  if (!summaryPath) {
    return;
  }

  const lines = [
    "## Agent Update Check",
    "",
    `Checked at: ${report.checked_at}`,
    "",
    `Updates detected: ${report.updates.length}`,
    "",
    "| Target | Mode | Source | Tracked | Latest | Result |",
    "| --- | --- | --- | --- | --- | --- |",
    ...statusRows.map((row) =>
      `| ${row.target} | ${row.mode} | ${row.source} | ${row.tracked} | ${row.latest} | ${row.result} |`,
    ),
    "",
  ];

  fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv);
  const catalogPath = args.catalog || "agents.json";
  const reportPath = args.report || "automation/agent-update-report.json";
  const checkedAt = args["checked-at"] || nowUtcIso();
  const githubOutput = args["github-output"];
  const stepSummary = args["step-summary"];
  const dryRun = args["dry-run"] === "true" || "dry-run" in args;

  const catalog = readJson(catalogPath);
  const agents = catalog.agents || [];

  const updates = [];
  const statusRows = [];

  for (const agent of agents) {
    const target = agent.target;
    const source = agent?.automation?.source;
    const autoEnabled = Boolean(agent?.automation?.enabled);
    const trackedVersion = agent?.tracked?.agent_version || "";

    if (!autoEnabled) {
      statusRows.push({
        target,
        mode: "manual",
        source: sourceLabel(source),
        tracked: trackedVersion,
        latest: "n/a",
        result: "skipped",
      });
      continue;
    }

    const resolved = await fetchLatestVersion(source);
    if (!resolved.supported) {
      statusRows.push({
        target,
        mode: "auto",
        source: sourceLabel(source),
        tracked: trackedVersion,
        latest: "n/a",
        result: "unsupported",
      });
      continue;
    }

    const latestVersion = resolved.latestVersion;

    const imageName = agent.image_name || agent.target;
    const hasLatest = await fetchLatestTagExists(imageName);

    if (hasLatest && latestVersion === trackedVersion) {
      statusRows.push({
        target,
        mode: "auto",
        source: sourceLabel(source),
        tracked: trackedVersion,
        latest: latestVersion,
        result: "no-change",
      });
      continue;
    }

    const nextTag = nextImageTag(agent?.tracked?.image_tag || "", checkedAt);
    const reason = hasLatest
      ? `Upstream ${sourceLabel(source)} updated`
      : "No latest tag on Docker Hub";
    const update = {
      target,
      image_name: agent.image_name,
      docker_context: agent.docker_context,
      dockerfile: agent.dockerfile,
      platforms: (agent.platforms || []).join(","),
      build_args: formatBuildArgs(agent.build_args),
      previous_agent_version: trackedVersion,
      agent_version: latestVersion,
      previous_image_tag: agent?.tracked?.image_tag || "",
      image_tag: nextTag,
      released_at: checkedAt,
      reason,
    };

    updates.push(update);

    statusRows.push({
      target,
      mode: "auto",
      source: sourceLabel(source),
      tracked: trackedVersion,
      latest: latestVersion,
      result: hasLatest ? `update -> ${nextTag}` : `no-latest -> ${nextTag}`,
    });
  }

  const report = {
    changed: updates.length > 0,
    checked_at: checkedAt,
    updates,
    matrix: {
      include: updates.map((update) => ({
        target: update.target,
        image_name: update.image_name,
        docker_context: update.docker_context,
        dockerfile: update.dockerfile,
        platforms: update.platforms,
        build_args: update.build_args,
        image_tag: update.image_tag,
      })),
    },
  };

  if (dryRun) {
    const col = (s, w) => `${s}`.padEnd(w);
    console.log(`\nDry run — checked at ${report.checked_at}`);
    console.log(`${"Target".padEnd(12)} ${"Tracked".padEnd(16)} ${"Latest".padEnd(16)} Result`);
    console.log(`${"-".repeat(12)} ${"-".repeat(16)} ${"-".repeat(16)} ${"-".repeat(30)}`);
    for (const row of statusRows) {
      console.log(`${col(row.target, 12)} ${col(row.tracked, 16)} ${col(row.latest, 16)} ${row.result}`);
    }
    console.log();
    if (report.changed) {
      console.log(`${report.updates.length} image(s) would be built:`);
      for (const u of report.updates) {
        console.log(`  ${u.target}: ${u.previous_agent_version} -> ${u.agent_version}  (image tag: ${u.image_tag}, platforms: ${u.platforms})`);
      }
    } else {
      console.log("No builds would be triggered.");
    }
    return;
  }

  writeJson(reportPath, report);
  appendSummary(stepSummary, report, statusRows);

  if (githubOutput) {
    writeGithubOutput(githubOutput, "changed", report.changed ? "true" : "false");
    writeGithubOutput(githubOutput, "updates_count", String(updates.length));
    writeGithubOutput(githubOutput, "checked_at", report.checked_at);
    writeGithubOutput(githubOutput, "matrix", report.matrix);
    writeGithubOutput(githubOutput, "updates_json", report.updates);
  }

  if (report.changed) {
    console.log(`Detected ${report.updates.length} update(s).`);
    for (const update of report.updates) {
      console.log(
        `${update.target}: ${update.previous_agent_version} -> ${update.agent_version}, image tag ${update.image_tag}`,
      );
    }
  } else {
    console.log("No updates detected.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
