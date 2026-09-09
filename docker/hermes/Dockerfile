# Hermes Agent is distributed as an official multi-arch image. Upstream
# explicitly does NOT support pip/PyPI installs any more — `setup.py` blocks
# `bdist_wheel`/`sdist` outside a Nix sandbox, and the last PyPI upload (0.19.0,
# 2026-07-20) predates that cutover. The supported channels are the shell
# installer, this image, and Nix, so VibePod layers on the published image.
#
# Upstream tags are CalVer (`v2026.9.7`); the internal `hermes --version`
# string (0.21.1) is a separate, decoupled number.
ARG HERMES_VERSION=v2026.9.7
FROM nousresearch/hermes-agent:${HERMES_VERSION}

# The base image owns the process contract: ENTRYPOINT is
# entrypoint-dispatch.sh, which delegates to s6-overlay's /init, runs
# /etc/cont-init.d/* in lexicographic order, then execs the CMD through
# docker/main-wrapper.sh. main-wrapper routes args as:
#   no args                    -> `hermes`
#   first arg is an executable -> exec it directly
#   anything else              -> `hermes <args>`
# and drops to the unprivileged `hermes` user via s6-setuidgid. VibePod's
# AgentSpec command (`hermes`, `hermes --yolo -z "<prompt>"`, `hermes-acp`)
# all take the bare-executable path, so ENTRYPOINT and CMD stay untouched.
#
# Do NOT add `USER` or run this image with `docker run --user`: main-wrapper
# rejects an arbitrary non-hermes UID and exits 1. Host-UID mapping goes
# through HERMES_UID/HERMES_GID instead, which 00-vibepod-uid supplies below.

# VibePod exports USER_UID/USER_GID into every agent container; upstream's
# stage2 hook reads HERMES_UID/HERMES_GID. This bridges the two before
# 01-hermes-setup runs (cont-init.d is ordered lexicographically).
COPY --chmod=0755 cont-init.d/00-vibepod-uid /etc/cont-init.d/00-vibepod-uid

# Runs after 01-hermes-setup has seeded config.yaml and chowned the volume.
COPY seed_skills_dir.py /opt/vibepod/seed_skills_dir.py
COPY --chmod=0755 cont-init.d/03-vibepod-skills /etc/cont-init.d/03-vibepod-skills
