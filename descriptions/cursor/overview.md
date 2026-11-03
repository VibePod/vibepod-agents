[Cursor CLI](https://cursor.com/cli), Cursor's coding agent for the terminal (`cursor-agent`), packaged as a container image.

## Image

- Debian Bookworm slim base with the vendor package and its bundled Node.js runtime
- Pinned to the release published by Cursor's install script
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Settings and credentials live under `/config`
- Includes `git` and `curl`
