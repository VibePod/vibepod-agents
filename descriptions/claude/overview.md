# vibepod/claude

[Claude Code](https://github.com/anthropics/claude-code) — Anthropic's official CLI — in a container.

Built on **Debian Bookworm Slim** (glibc). Alpine/musl is not supported by Claude's native binaries. Available for `linux/amd64` and `linux/arm64`.

## Features

- Installed via the official Claude native installer (`claude.ai/install.sh`)
- Dynamic UID/GID mapping — runs as your host user, not root
- Proxy CA cert support via `SSL_CERT_FILE`
- Auto-updater and telemetry disabled
- Includes: `git`, `ripgrep`, `python3`, `curl`, `jq`
- Pre-configured with the official Claude plugins marketplace

## Tags

Tags follow `YYYY.MM.N` (e.g. `2026.03.3`) plus `latest`.

## Usage

```bash
docker run -it --rm \
  -e USER_UID=$(id -u) \
  -e USER_GID=$(id -g) \
  -v $(pwd):/workspace \
  vibepod/claude
```

## Source

[github.com/VibePod/vibepod-agents](https://github.com/VibePod/vibepod-agents)
