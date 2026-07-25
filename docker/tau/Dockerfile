# Tau is a pure-Python agent (tau-ai on PyPI) and needs Python >= 3.12.
FROM python:3.12-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# uv installs Tau into an isolated tool environment and links `tau` into
# /usr/local/bin, so the command stays on PATH for whatever HOME the container
# runs with.
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv

ENV UV_TOOL_DIR=/opt/uv/tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

# Containers run a fixed, baked-in version; a new image is published per release.
ENV TAU_NO_UPDATE_CHECK=1

ARG TAU_VERSION=0.3.3
RUN uv tool install "tau-ai==${TAU_VERSION}" \
    && chmod -R a+rX /opt/uv \
    && tau --version

ENV HOME=/config

# Set a standard terminal type so the Textual TUI renders correctly.
ENV TERM=xterm-256color

RUN mkdir -p /config/.tau /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["tau"]
