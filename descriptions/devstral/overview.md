[Mistral Vibe](https://github.com/mistralai/mistral-vibe), Mistral's coding CLI for Devstral models, packaged as a container image.

## Image

- Debian Bookworm slim base, installed with the official Vibe installer
- Runs as root inside the container (no UID mapping)
- Includes `git`, `curl` and Node.js
