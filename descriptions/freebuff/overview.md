[Freebuff](https://www.npmjs.com/package/freebuff), a free coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, pinned npm release per image
- The npm launcher downloads the native binary on first run
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
