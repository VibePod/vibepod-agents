# vibepod-agents

`vibepod-agents` builds and publishes the VibePod agent images using a root `compose.yml`.

Proxy image publishing is intentionally not part of this repository anymore.

## Repository Layout

```text
compose.yml
docker/
  claude/
  gemini/
  opencode/
  devstral/
  auggie/
  copilot/
  codex/
  pi/
  agy/
  tau/
  jcode/
  qwen/
  freebuff/
  dsh/
.github/workflows/
  build.yml
  auto-release.yml
automation/
  agent-versions.json
scripts/
  bootstrap-wiki.mjs
  check-agent-updates.mjs
  apply-agent-updates.mjs
  smoke-agent-images.mjs
  lib/
    catalog.mjs
```

## Image Targets

| Target | Docker Hub | Version Source |
| --- | --- | --- |
| `claude` | `vibepod/claude` | [github:anthropics/claude-code](https://github.com/anthropics/claude-code/releases/latest) |
| `gemini` | `vibepod/gemini` | [npm:@google/gemini-cli](https://www.npmjs.com/package/@google/gemini-cli) |
| `opencode` | `vibepod/opencode` | [npm:opencode-ai](https://www.npmjs.com/package/opencode-ai) |
| `devstral` | `vibepod/devstral` | [github:mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe/releases/latest) |
| `auggie` | `vibepod/auggie` | [npm:@augmentcode/auggie](https://www.npmjs.com/package/@augmentcode/auggie) |
| `copilot` | `vibepod/copilot` | [npm:@github/copilot](https://www.npmjs.com/package/@github/copilot) |
| `codex` | `vibepod/codex` | [npm:@openai/codex](https://www.npmjs.com/package/@openai/codex) |
| `pi` | `vibepod/pi` | [npm:@earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) |
| `agy` | `vibepod/agy` | [github:google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli/releases/latest) |
| `tau` | `vibepod/tau` | [pypi:tau-ai](https://pypi.org/project/tau-ai/) |
| `jcode` | `vibepod/jcode` | [github:1jehuang/jcode](https://github.com/1jehuang/jcode/releases/latest) |
| `qwen` | `vibepod/qwen` | [npm:@qwen-code/qwen-code](https://www.npmjs.com/package/@qwen-code/qwen-code) |
| `freebuff` | `vibepod/freebuff` | [npm:freebuff](https://www.npmjs.com/package/freebuff) |
| `dsh` | `vibepod/dsh` | [npm:@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) |

Defaults:

- `AGENT_NAMESPACE=vibepod`
- `IMAGE_TAG=latest`
- `CLAUDE_CODE_CHANNEL=latest`

## Local Usage

```bash
cd /workspace/vibepod-agents
cp .env.example .env

docker compose version
docker compose config --services
```

Build and push all targets:

```bash
IMAGE_TAG=0.3.0 docker compose build
IMAGE_TAG=0.3.0 docker compose push
```

Build and push selected targets:

```bash
IMAGE_TAG=0.3.0 docker compose build claude gemini codex pi agy
IMAGE_TAG=0.3.0 docker compose push claude gemini codex pi agy
```

## Smoke Tests

Run smoke tests against already-published images:

```bash
node scripts/smoke-agent-images.mjs --pull
```

Build local images and smoke test them:

```bash
IMAGE_TAG=ci-smoke node scripts/smoke-agent-images.mjs --build
```

Run one or more selected targets:

```bash
node scripts/smoke-agent-images.mjs --targets claude,codex --pull
IMAGE_TAG=ci-smoke node scripts/smoke-agent-images.mjs --targets pi,agy --build
```

Each target runs a simple argument-forwarding command through the image and the
catalog `version_command`. If Docker is not installed or the daemon is not
available, the script prints a `SKIP` message and exits successfully.

Claude image note:
- `docker/claude` follows the official Claude Code setup via the native installer (`https://claude.ai/install.sh`).
- Use `CLAUDE_CODE_CHANNEL=stable` (or another supported channel) when building if needed.

## CI Pipelines

- `build.yml`: validates every Docker context on PRs and pushes to `main`
  - multi-arch builds: `linux/amd64`, `linux/arm64`
  - `devstral` and `agy` are intentionally `linux/amd64` only
  - each matrix target also builds a local image and runs the smoke test script
- `auto-release.yml`: checks upstream CLI versions every 6 hours (and on manual dispatch)
  - publishes to Docker Hub namespace `vibepod` (`https://hub.docker.com/u/vibepod`)
  - uses `agents.json` as the source of truth for image definitions and build configuration
  - uses the repository wiki as the source-of-truth release state store
  - canonical state file in wiki repo: `automation/agent-versions.json`
  - generated tracking page in wiki repo: `Container-Versions.md`
  - tracking page URL: `https://github.com/VibePod/vibepod-agents/wiki/Container-Versions`
  - CI is update-only (fails if wiki state/page are missing)
  - creates a new image only when tracked upstream version changes
  - manual dispatch supports `force_recreate_latest=true` to rebuild unchanged agents and publish a new dated tag plus `latest`
  - after fixing a stale image whose tracked version is already current, manually dispatch with `force_recreate_latest=true` so the corrected build configuration is used
  - publishes `<YYYY.MM.N>` and `latest` for changed containers only
  - updates wiki state after a successful publish

## Versioning Rules

- Automated image tags follow `YYYY.MM.N` (UTC).
- `N` starts at `1` for each container at the first release in a new month.
- `N` increments by `1` when that container's wrapped CLI version changes again in the same month.
- Every automated publish also updates the `latest` tag.

## Manual Updates And Catalog

`agents.json` is authoritative for image definitions and build configuration. The wiki state file `automation/agent-versions.json` is authoritative for tracked agent versions and release history. Auto-release merges those sources by target before planning builds.

- One-time local bootstrap of wiki state from Docker Hub:
```bash
git clone https://github.com/VibePod/vibepod-agents.wiki.git wiki
node scripts/bootstrap-wiki.mjs --wiki wiki --all-tags
```
  - fetches all tags from Docker Hub, pulls each image, and runs `--version` to resolve agent versions
  - `--all-tags` inspects every historical tag (not just the latest); omit it to only inspect the most recent tag per agent
  - `--skip-inspect` skips Docker image inspection entirely (agent versions recorded as `"unknown"`)
- Commit and push the initialized wiki state manually:
```bash
cd wiki
git add automation/agent-versions.json Container-Versions.md
git commit -m "chore: initialize agent version state"
git push
```
- For fully automated containers (`automation.enabled=true`), the workflow checks upstream sources (npm packages, PyPI projects and GitHub releases) and publishes only on version change.
- Current GitHub-release tracked containers:
  - `claude` -> `anthropics/claude-code`
  - `devstral` -> `mistralai/mistral-vibe`
  - `agy` -> `google-antigravity/antigravity-cli`
  - `jcode` -> `1jehuang/jcode`
- Current PyPI tracked containers:
  - `tau` -> `tau-ai`
- If you publish manually for Dockerfile/image-only changes, update `tracked.agent_version`, `tracked.image_tag`, and `release_history` in the wiki catalog so automation stays in sync.
- After manual state changes, re-run bootstrap to regenerate the tracking page (in wiki clone):

```bash
node scripts/bootstrap-wiki.mjs --wiki wiki --skip-inspect
```
