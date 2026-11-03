[Tau](https://pypi.org/project/tau-ai/), a Python coding agent CLI, packaged as a container image.

## Image

- Python 3.12 slim base, installed with `uv` into an isolated tool environment
- Update check disabled; a new image is published for each upstream release
- Runs as your host user through `USER_UID`/`USER_GID` mapping
- Settings live under `/config`
- Includes `git`
