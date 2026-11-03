[GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot), GitHub's coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, installed from npm
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
