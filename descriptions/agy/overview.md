[Antigravity CLI](https://github.com/google-antigravity/antigravity-cli), Google's agentic coding CLI, packaged as a container image.

## Image

- Debian Bookworm slim base, installed with the official Antigravity installer
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Built-in auto-updater disabled; a new image is published for each upstream release
- Trusts a mounted proxy CA certificate passed via `SSL_CERT_FILE`
- Includes `git` and `curl`
