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
.github/workflows/
  build.yml
  auto-release.yml
automation/
  agent-versions.json
scripts/
  bootstrap-wiki.mjs
  check-agent-updates.mjs
  apply-agent-updates.mjs
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
IMAGE_TAG=0.3.0 docker compose build claude gemini codex
IMAGE_TAG=0.3.0 docker compose push claude gemini codex
```

Claude image note:
- `docker/claude` follows the official Claude Code setup via the native installer (`https://claude.ai/install.sh`).
- Use `CLAUDE_CODE_CHANNEL=stable` (or another supported channel) when building if needed.

## CI Pipelines

- `build.yml`: validates every Docker context on PRs and pushes to `main`
  - multi-arch builds: `linux/amd64`, `linux/arm64`
  - `devstral` is intentionally `linux/amd64` only
- `auto-release.yml`: checks upstream CLI versions every 6 hours (and on manual dispatch)
  - publishes to Docker Hub namespace `vibepod` (`https://hub.docker.com/u/vibepod`)
  - uses the repository wiki as the source-of-truth state store
  - canonical state file in wiki repo: `automation/agent-versions.json`
  - generated tracking page in wiki repo: `Container-Versions.md`
  - tracking page URL: `https://github.com/VibePod/vibepod-agents/wiki/Container-Versions`
  - CI is update-only (fails if wiki state/page are missing)
  - creates a new image only when tracked upstream version changes
  - publishes `<YYYY.MM.N>` and `latest` for changed containers only
  - updates wiki state after a successful publish

## Versioning Rules

- Automated image tags follow `YYYY.MM.N` (UTC).
- `N` starts at `1` for each container at the first release in a new month.
- `N` increments by `1` when that container's wrapped CLI version changes again in the same month.
- Every automated publish also updates the `latest` tag.

## Manual Updates And Catalog

The wiki state file `automation/agent-versions.json` is the release catalog used by automation.

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
- For fully automated containers (`automation.enabled=true`), the workflow checks upstream sources (npm packages and GitHub releases) and publishes only on version change.
- Current GitHub-release tracked containers:
  - `claude` -> `anthropics/claude-code`
  - `devstral` -> `mistralai/mistral-vibe`
- If you publish manually for Dockerfile/image-only changes, update `tracked.agent_version`, `tracked.image_tag`, and `release_history` in the wiki catalog so automation stays in sync.
- After manual state changes, re-run bootstrap to regenerate the tracking page (in wiki clone):

```bash
node scripts/bootstrap-wiki.mjs --wiki wiki --skip-inspect
```
