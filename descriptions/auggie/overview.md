[Auggie](https://www.npmjs.com/package/@augmentcode/auggie), the Augment Code coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, installed from npm
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
