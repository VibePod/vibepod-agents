[Qwen Code](https://github.com/QwenLM/qwen-code), the Qwen coding agent CLI, packaged as a container image.

## Image

- Node.js 22 Debian slim base, pinned npm release per image
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
