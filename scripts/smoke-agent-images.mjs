#!/usr/bin/env node

import { spawnSync } from "node:child_process";

import { parseArgs, readJson } from "./lib/catalog.mjs";

const DEFAULT_CATALOG = "agents.json";
const DEFAULT_NAMESPACE = process.env.AGENT_NAMESPACE || "vibepod";
const DEFAULT_IMAGE_TAG = process.env.IMAGE_TAG || "latest";
const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.SMOKE_TIMEOUT_MS || "120000",
  10,
);
const ARG_FORWARDING_COMMAND = ["echo", "vibepod-smoke"];

function splitList(value) {
  return `${value || ""}`
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

function dockerIsAvailable() {
  const version = run("docker", ["--version"]);
  if (version.error?.code === "ENOENT") {
    return { available: false, reason: "Docker CLI was not found on PATH." };
  }
  if (version.status !== 0) {
    return {
      available: false,
      reason: `Docker CLI check failed: ${(version.stderr || version.stdout || "").trim()}`,
    };
  }

  const info = run("docker", ["info"]);
  if (info.status !== 0) {
    return {
      available: false,
      reason: `Docker daemon is not available: ${(info.stderr || info.stdout || "").trim()}`,
    };
  }

  return { available: true, reason: "" };
}

function dockerComposeIsAvailable() {
  const result = run("docker", ["compose", "version"]);
  return result.status === 0;
}

function commandForDisplay(command, args) {
  return [command, ...args].join(" ");
}

function printCommandOutput(result) {
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (stdout) {
    console.error(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }
}

function failStep(target, step, image, command, args, result) {
  console.error(`[${target}] ${step} failed for ${image}`);
  console.error(`command: ${commandForDisplay(command, args)}`);
  printCommandOutput(result);
}

function imageRef(agent, namespace, imageTag) {
  return `${namespace}/${agent.image_name || agent.target}:${imageTag}`;
}

function loadAgents(catalogPath) {
  const catalog = readJson(catalogPath);
  return catalog.agents || [];
}

function selectAgents(agents, requestedTargets) {
  if (requestedTargets.length === 0) {
    return agents;
  }

  const byTarget = new Map(agents.map((agent) => [agent.target, agent]));
  return requestedTargets.map((target) => {
    const agent = byTarget.get(target);
    if (!agent) {
      throw new Error(`Unknown smoke-test target: ${target}`);
    }
    return agent;
  });
}

function prepareImage(agent, image, options) {
  if (options.build) {
    const args = ["compose", "build", agent.target];
    const result = run("docker", args, {
      env: {
        ...process.env,
        AGENT_NAMESPACE: options.namespace,
        IMAGE_TAG: options.imageTag,
      },
    });
    if (result.status !== 0) {
      failStep(agent.target, "build", image, "docker", args, result);
      return false;
    }
    return true;
  }

  if (options.pull) {
    const args = ["pull", image];
    const result = run("docker", args);
    if (result.status !== 0) {
      failStep(agent.target, "pull", image, "docker", args, result);
      return false;
    }
  }

  return true;
}

function runArgForwardingSmoke(agent, image) {
  const args = ["run", "--rm", image, ...ARG_FORWARDING_COMMAND];
  const result = run("docker", args);
  if (result.status !== 0) {
    failStep(agent.target, "run", image, "docker", args, result);
    return false;
  }

  if (!(result.stdout || "").includes("vibepod-smoke")) {
    failStep(agent.target, "run", image, "docker", args, {
      ...result,
      stderr: `Expected smoke output "vibepod-smoke", got: ${(result.stdout || "").trim()}`,
    });
    return false;
  }

  return true;
}

function runVersionSmoke(agent, image) {
  const command = agent.version_command;
  if (!command) {
    console.log(`[${agent.target}] SKIP: no version_command configured`);
    return true;
  }

  const args = [
    "run",
    "--rm",
    "-e",
    "USER_UID=0",
    "-e",
    "USER_GID=0",
    "-e",
    "NPM_CONFIG_UPDATE_NOTIFIER=false",
    image,
    "sh",
    "-lc",
    command,
  ];
  const result = run("docker", args);
  if (result.status !== 0) {
    failStep(agent.target, "run", image, "docker", args, result);
    return false;
  }

  return true;
}

export function smokeAgentImages({
  catalogPath = DEFAULT_CATALOG,
  namespace = DEFAULT_NAMESPACE,
  imageTag = DEFAULT_IMAGE_TAG,
  targets = [],
  build = false,
  pull = false,
} = {}) {
  const docker = dockerIsAvailable();
  if (!docker.available) {
    console.log(`SKIP: Docker is not available. ${docker.reason}`);
    return 0;
  }

  if (build && !dockerComposeIsAvailable()) {
    console.log("SKIP: Docker Compose is not available.");
    return 0;
  }

  const agents = selectAgents(loadAgents(catalogPath), targets);
  let failed = false;

  for (const agent of agents) {
    const image = imageRef(agent, namespace, imageTag);
    console.log(`[${agent.target}] smoke testing ${image}`);

    if (!prepareImage(agent, image, { build, pull, namespace, imageTag })) {
      failed = true;
      continue;
    }

    if (!runArgForwardingSmoke(agent, image)) {
      failed = true;
      continue;
    }

    if (!runVersionSmoke(agent, image)) {
      failed = true;
      continue;
    }

    console.log(`[${agent.target}] PASS`);
  }

  if (failed) {
    return 1;
  }

  console.log(`PASS: ${agents.length} agent image smoke test(s) passed.`);
  return 0;
}

function main() {
  const args = parseArgs(process.argv);
  const build = args.build === "true" || "build" in args;
  const pull = args.pull === "true" || "pull" in args;
  const skipBuild = args["skip-build"] === "true" || "skip-build" in args;

  if (build && pull) {
    console.error("Choose either --build or --pull, not both.");
    process.exit(2);
  }

  const exitCode = smokeAgentImages({
    catalogPath: args.catalog || DEFAULT_CATALOG,
    namespace: args.namespace || DEFAULT_NAMESPACE,
    imageTag: args["image-tag"] || DEFAULT_IMAGE_TAG,
    targets: splitList(args.targets),
    build: build && !skipBuild,
    pull: pull && !skipBuild,
  });

  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
