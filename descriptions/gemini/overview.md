# vibepod/gemini

[Gemini CLI](https://github.com/google-gemini/gemini-cli) — Google's official AI CLI — in a container.

Built on **Node.js 22 Alpine**. Available for `linux/amd64` and `linux/arm64`.

## Features

- Dynamic UID/GID mapping — runs as your host user, not root
- Includes: `git`

## Tags

Tags follow `YYYY.MM.N` (e.g. `2026.03.1`) plus `latest`.

## Usage

```bash
docker run -it --rm \
  -e USER_UID=$(id -u) \
  -e USER_GID=$(id -g) \
  -v $(pwd):/workspace \
  vibepod/gemini
```

## Source

[github.com/VibePod/vibepod-agents](https://github.com/VibePod/vibepod-agents)
