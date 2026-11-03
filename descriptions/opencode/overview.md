[OpenCode](https://opencode.ai), an open-source coding agent for the terminal, packaged as a container image.

## Image

- Node.js 22 Debian slim base, installed from npm
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
