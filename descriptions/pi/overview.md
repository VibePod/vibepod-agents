[Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent), a minimal coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, installed from npm
- Version check disabled; a new image is published for each upstream release
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Settings live under `/config`
- Includes `git`
