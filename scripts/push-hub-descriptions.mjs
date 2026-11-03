#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, readJson } from "./lib/catalog.mjs";

const HUB_API = "https://hub.docker.com/v2";

export async function loginToDockerHub(username, token, fetchImpl = fetch) {
  const response = await fetchImpl(`${HUB_API}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) {
    throw new Error(`Docker Hub login failed (HTTP ${response.status})`);
  }
  return payload.token;
}

export async function pushDescription({
  repository,
  shortDescription,
  overview,
  jwt,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${HUB_API}/repositories/${repository}/`, {
    method: "PATCH",
    headers: {
      Authorization: `JWT ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: shortDescription,
      full_description: overview,
    }),
  });
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to update ${repository} (HTTP ${response.status}): ${body.slice(0, 300)}`,
    );
  }
  return true;
}

export async function pushDescriptions({
  agents,
  outputRoot,
  namespace,
  jwt,
  fetchImpl = fetch,
}) {
  const failures = [];
  for (const agent of agents) {
    const outputDir = path.join(outputRoot, agent.target);
    const repository = `${namespace}/${agent.image_name || agent.target}`;
    try {
      const updated = await pushDescription({
        repository,
        shortDescription: fs.readFileSync(
          path.join(outputDir, "short-description.txt"),
          "utf8",
        ),
        overview: fs.readFileSync(path.join(outputDir, "overview.md"), "utf8"),
        jwt,
        fetchImpl,
      });
      console.log(
        updated
          ? `updated: ${repository}`
          : `skipped: ${repository} is not published yet`,
      );
    } catch (error) {
      failures.push(agent.target);
      console.error(error instanceof Error ? error.message : error);
    }
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv);
  const definitionsPath = args.definitions || "agents.json";
  const outputRoot = args.output || "reports/hub-descriptions";
  const namespace = args.namespace || "vibepod";
  const { DOCKERHUB_USERNAME, DOCKERHUB_TOKEN } = process.env;

  if (!DOCKERHUB_USERNAME || !DOCKERHUB_TOKEN) {
    throw new Error("DOCKERHUB_USERNAME and DOCKERHUB_TOKEN must be set");
  }

  let agents = readJson(definitionsPath).agents || [];
  if (args.targets) {
    const targets = new Set(args.targets.split(",").map((t) => t.trim()));
    agents = agents.filter((agent) => targets.has(agent.target));
  }

  const jwt = await loginToDockerHub(DOCKERHUB_USERNAME, DOCKERHUB_TOKEN);
  const failures = await pushDescriptions({
    agents,
    outputRoot,
    namespace,
    jwt,
  });
  if (failures.length > 0) {
    throw new Error(`Failed to update: ${failures.join(", ")}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
