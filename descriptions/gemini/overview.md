[Gemini CLI](https://github.com/google-gemini/gemini-cli), Google's open-source AI agent for the terminal, packaged as a container image.

## Image

- Node.js 22 Alpine base, installed from npm
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Includes `git`
