# vibepod/opencode

[Opencode](https://opencode.ai) — an open-source AI coding CLI — in a container.

Built on **Node.js 22 Debian Slim**. Available for `linux/amd64` and `linux/arm64`.

## Features

- Dynamic UID/GID mapping — runs as your host user, not root
- Includes: `git`, `ca-certificates`

## Tags

Tags follow `YYYY.MM.N` (e.g. `2026.03.1`) plus `latest`.

## Usage

```bash
docker run -it --rm \
  -e USER_UID=$(id -u) \
  -e USER_GID=$(id -g) \
  -v $(pwd):/workspace \
  vibepod/opencode
```

## Source

[github.com/VibePod/vibepod-agents](https://github.com/VibePod/vibepod-agents)
