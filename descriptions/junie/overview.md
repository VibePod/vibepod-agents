[Junie](https://github.com/JetBrains/junie), JetBrains' coding agent CLI, packaged as a container image.

## Image

- Debian Trixie slim base with the official Junie release archive
- Update check disabled; a new image is published for each upstream release
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Settings live under `/config`
- Trusts a mounted proxy CA certificate passed via `SSL_CERT_FILE`
- Includes `git` and `curl`
