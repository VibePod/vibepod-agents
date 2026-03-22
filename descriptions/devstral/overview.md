# vibepod/devstral

[Devstral / mistral-vibe](https://github.com/mistralai/mistral-vibe) — Mistral's coding CLI — in a container.

Built on **Debian Bookworm Slim**. Available for `linux/amd64` only (arm64 is not currently supported by the upstream installer).

## Features

- Dynamic UID/GID mapping — runs as your host user, not root
- Includes: `git`, `curl`, `ca-certificates`

## Tags

Tags follow `YYYY.MM.N` (e.g. `2026.03.1`) plus `latest`.

## Usage

```bash
docker run -it --rm \
  -e USER_UID=$(id -u) \
  -e USER_GID=$(id -g) \
  -v $(pwd):/workspace \
  vibepod/devstral
```

## Source

[github.com/VibePod/vibepod-agents](https://github.com/VibePod/vibepod-agents)
