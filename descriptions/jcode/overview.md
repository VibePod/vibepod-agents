[jcode](https://github.com/1jehuang/jcode), a coding agent CLI, packaged as a container image.

## Image

- Debian Trixie slim base with the checksum-verified upstream release binary
- Self-update disabled; a new image is published for each upstream release
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Settings live under `/config`
- Includes `git` and `curl`
