[Claude Code](https://github.com/anthropics/claude-code), Anthropic's agentic coding CLI, packaged as a container image.

## Image

- Debian Bookworm slim base (glibc), installed with the official native installer
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Auto-updater, telemetry and error reporting disabled
- Official Claude plugins marketplace preconfigured
- Trusts a mounted proxy CA certificate passed via `SSL_CERT_FILE`
- Includes `git`, `ripgrep`, `jq`, `curl`, `python3` and Node.js
