FROM node:22-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    jq \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# The npm package "cline" is a Node launcher; npm resolves the matching
# self-contained binary (Bun runtime embedded) from the per-platform optional
# dependency @cline/cli-linux-{x64,arm64}. The launcher also merges the OS
# trust store into NODE_EXTRA_CA_CERTS for the binary, which needs
# Node >= 22.15. Automation tracks the npm package and bumps this pin.
ARG CLINE_VERSION=3.0.65
RUN npm install -g "cline@${CLINE_VERSION}" \
    && cline --version

# Containers run a fixed, baked-in version; a new image is published per
# release, so Cline's background self-update (npm install -g as the
# unprivileged runtime user) is disabled.
ENV CLINE_NO_AUTO_UPDATE=1

# Cline keeps settings, provider credentials (data/settings/providers.json),
# sessions, rules, skills and hooks under ~/.cline, and also scans
# ~/.agents/skills; with HOME on the persisted /config mount both survive
# container restarts.
ENV HOME=/config
ENV TERM=xterm-256color

RUN mkdir -p /config/.cline /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["cline"]
