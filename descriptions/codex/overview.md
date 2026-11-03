[Codex CLI](https://github.com/openai/codex), OpenAI's coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, installed from npm
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Optional OAuth callback forwarding for browser sign-in (`VIBEPOD_OAUTH_FORWARD_PORT`)
- Includes `git`
