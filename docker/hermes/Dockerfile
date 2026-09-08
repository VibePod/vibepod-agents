# Hermes Agent is a pure-Python agent (hermes-agent on PyPI) that requires
# Python >= 3.11, < 3.14.
FROM python:3.12-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

# ripgrep powers Hermes' file search; it degrades to `grep` without it, but the
# fallback is markedly slower on large workspaces.
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    gosu \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Hermes' Ink TUI (`hermes --tui`) is a pre-built bundle shipped inside the
# wheel at hermes_cli/tui_dist/entry.js, so it needs a Node runtime but no npm
# install. Both images are Debian bookworm, so the copied binary's ABI matches.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node

# uv installs Hermes into an isolated tool environment and links `hermes` into
# /usr/local/bin, so the command stays on PATH for whatever HOME the container
# runs with.
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv

ENV UV_TOOL_DIR=/opt/uv/tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

# Containers run a fixed, baked-in version; a new image is published per release.
# The [acp] extra pulls agent-client-protocol, which the bundled `hermes-acp`
# console script imports at startup — without it `vp run hermes --acp` fails
# with ModuleNotFoundError: No module named 'acp'. uv links all three of the
# package's entry points (hermes, hermes-acp, hermes-agent) into
# UV_TOOL_BIN_DIR, so no extra wiring is needed to put hermes-acp on PATH.
ARG HERMES_VERSION=0.19.0
RUN uv tool install "hermes-agent[acp]==${HERMES_VERSION}" \
    && chmod -R a+rX /opt/uv \
    && hermes --version \
    && hermes-acp --check \
    && node --version

# Hermes derives every durable path from $HERMES_HOME (config.yaml, .env,
# credentials, state.db, skills/, plugins/). It defaults to $HOME/.hermes, but
# is set explicitly here so the state path survives gosu re-deriving HOME from
# the passwd entry.
ENV HOME=/config
ENV HERMES_HOME=/config/.hermes

# Set a standard terminal type so the REPL and the Ink TUI render correctly.
ENV TERM=xterm-256color

RUN mkdir -p /config/.hermes /config/.agents/skills /workspace

COPY seed_skills_dir.py /usr/local/lib/vibepod/seed_skills_dir.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["hermes"]
