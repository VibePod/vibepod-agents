import fs from "node:fs";

export function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function nowUtcIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function versionMonthPrefix(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}.${month}`;
}

export function nextImageTag(previousTag, isoTimestamp) {
  const prefix = versionMonthPrefix(isoTimestamp);
  const match = /^(\d{4}\.\d{2})\.(\d+)$/.exec(previousTag || "");

  if (match && match[1] === prefix) {
    const nextSequence = Number.parseInt(match[2], 10) + 1;
    return `${prefix}.${nextSequence}`;
  }

  return `${prefix}.1`;
}

export function markdownTable(headers, rows) {
  const escapedHeaders = headers.map((header) => header.replace(/\|/g, "\\|"));
  const headerLine = `| ${escapedHeaders.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((row) => {
    const escaped = row.map((cell) => `${cell ?? ""}`.replace(/\|/g, "\\|"));
    return `| ${escaped.join(" | ")} |`;
  });

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

function dockerRepoFor(agent) {
  const imageName = agent?.image_name || agent?.target || "";
  return `vibepod/${imageName}`;
}

function dockerRepoLink(agent) {
  const repo = dockerRepoFor(agent);
  return `[${repo}](https://hub.docker.com/r/${repo})`;
}

export function dockerTagLink(agent, tag) {
  if (!tag) {
    return "";
  }
  const repo = dockerRepoFor(agent);
  return `[${tag}](https://hub.docker.com/r/${repo}/tags?name=${encodeURIComponent(tag)})`;
}

function sourceLabel(agent) {
  const source = agent?.automation?.source || {};
  if (source.type === "npm") {
    const pkg = source.package || "";
    return `[npm:${pkg}](https://www.npmjs.com/package/${pkg})`;
  }
  if (source.type === "github_release") {
    const repo = source.repo || "";
    return `[github:${repo}](https://github.com/${repo}/releases/latest)`;
  }
  if (source.type === "manual") {
    return "manual";
  }
  return source.type || "unknown";
}

export function renderVersionsMarkdown(catalog, generatedAt) {
  const generatedIso = generatedAt || nowUtcIso();
  const agents = [...(catalog.agents || [])].sort((a, b) =>
    (a.target || "").localeCompare(b.target || ""),
  );

  const summaryRows = agents.map((agent) => [
    `[${agent.target}](https://hub.docker.com/r/${dockerRepoFor(agent)})`,
    sourceLabel(agent),
    agent.tracked?.agent_version || "",
    dockerTagLink(agent, "latest"),
    agent.tracked?.last_updated || "",
  ]);

  const summaryTable = markdownTable(
    [
      "Container",
      "Version Source",
      "Agent Version",
      "Latest Tag",
      "Last Updated (UTC)",
    ],
    summaryRows,
  );

  const historySections = agents.map((agent) => {
    const releases = [...(agent.release_history || [])]
      .filter((release) => {
        const tag = release?.image_tag || "";
        return tag !== "next" && tag !== "latest";
      })
      .sort((left, right) => (right.released_at || "").localeCompare(left.released_at || ""));

    const header = `### ${agent.target}`;
    if (releases.length === 0) {
      return `${header}\n\nNo releases recorded.\n`;
    }

    const rows = releases.map((release) => [
      dockerTagLink(agent, release.image_tag || ""),
      release.agent_version || "",
      release.released_at || "",
    ]);

    const table = markdownTable(["Image Tag", "Agent Version", "Released At (UTC)"], rows);

    return `${header}\n\n${table}\n`;
  });

  const alwaysShowNextTargets = new Set(["claude", "codex"]);

  const nextRows = agents
    .filter((agent) => {
      const trackedIsNext = (agent?.tracked?.image_tag || "") === "next";
      const historyHasNext = (agent.release_history || []).some(
        (release) => (release?.image_tag || "") === "next",
      );
      return trackedIsNext || historyHasNext || alwaysShowNextTargets.has(agent.target || "");
    })
    .map((agent) => [
      agent.target,
      dockerRepoLink(agent),
      dockerTagLink(agent, "next"),
      "Testing only",
    ]);

  const nextTable =
    nextRows.length > 0
      ? markdownTable(["Container", "Docker Hub", "Next Tag", "Purpose"], nextRows)
      : "No `next` images recorded.";

  return [
    "# Container Versions",
    "",
    "This file is generated from `automation/agent-versions.json`.",
    `Generated at: ${generatedIso}`,
    "",
    "## Latest Versions",
    "",
    summaryTable,
    "",
    "## Release History",
    "",
    ...historySections,
    "",
    "## Next Images",
    "",
    "`next` images are pre-release builds and are only intended for testing.",
    "",
    nextTable,
    "",
  ].join("\n");
}

export function writeGithubOutput(outputPath, key, value) {
  const normalized = typeof value === "string" ? value : JSON.stringify(value);
  if (!normalized.includes("\n")) {
    fs.appendFileSync(outputPath, `${key}=${normalized}\n`, "utf8");
    return;
  }

  const marker = `EOF_${Math.random().toString(16).slice(2)}`;
  fs.appendFileSync(
    outputPath,
    `${key}<<${marker}\n${normalized}\n${marker}\n`,
    "utf8",
  );
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}
