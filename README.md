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
  release.yml
Makefile
```

## Image Targets

- `claude` -> `<agent-namespace>/claude:<tag>`
- `gemini` -> `<agent-namespace>/gemini:<tag>`
- `opencode` -> `<agent-namespace>/opencode:<tag>`
- `devstral` -> `<agent-namespace>/devstral:<tag>` (amd64 only)
- `auggie` -> `<agent-namespace>/auggie:<tag>`
- `copilot` -> `<agent-namespace>/copilot:<tag>`
- `codex` -> `<agent-namespace>/codex:<tag>`

Defaults:

- `AGENT_NAMESPACE=vibepod`
- `IMAGE_TAG=latest`
- `CLAUDE_CODE_CHANNEL=latest`

## Local Usage

```bash
cd /workspace/vibepod-agents
cp .env.example .env

make doctor
make list
```

Build and push all targets:

```bash
IMAGE_TAG=0.3.0 make release
```

Build and push selected targets:

```bash
IMAGE_TAG=0.3.0 make build TARGETS="claude gemini codex"
IMAGE_TAG=0.3.0 make push TARGETS="claude gemini codex"
```

Direct compose usage also works:

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
- `release.yml`: publishes images on tag push (`v*`) or manual dispatch
  - pushes `<version>` and optionally `latest`
  - requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets
  - optional repo variable: `AGENT_NAMESPACE`

## Wire Into VibePod CLI

```bash
eval "$(IMAGE_TAG=0.3.0 make env)"
vp run codex
```
