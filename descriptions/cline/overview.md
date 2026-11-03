[Cline](https://www.npmjs.com/package/cline), the Cline coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, pinned npm release per image
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Self-update disabled; settings and credentials live under `/config`
- Trusts a mounted proxy CA certificate passed via `SSL_CERT_FILE`
- Includes `git`, `ripgrep`, `jq` and `curl`
