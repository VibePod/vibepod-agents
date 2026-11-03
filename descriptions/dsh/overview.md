[DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (`dsh`), DeepSeek's coding agent, packaged as a container image.

## Image

- Node.js 22 Debian slim base, pinned npm release per image (upstream is a developer preview)
- Starts the web UI by default (`dsh web --no-open`); `VIBEPOD_WEB_FORWARD_PORT` forwards it out of the container
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git` and `pnpm`
