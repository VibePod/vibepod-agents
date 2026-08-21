FROM node:22-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

# socat bridges the container bridge interface to dsh's loopback-only Web UI
# (dsh web intentionally rejects --host 0.0.0.0); pnpm is required on PATH by
# `dsh plugin`, which forwards profile plugin management to pnpm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
    gosu \
    socat \
    && rm -rf /var/lib/apt/lists/*

# dsh's docs assume pnpm >= 10 behavior (allowBuilds), so pin the major.
RUN npm install -g pnpm@10

# DeepSeek Harness is a developer preview with explicit compatibility-breaking
# change warnings, so the image pins an exact version; automation bumps it.
ARG DSH_VERSION=0.1.1-rc.1
RUN npm install -g "@deepseek-ai/dsh@${DSH_VERSION}" \
    && dsh --version

# The harness keeps all user data under $DSH_HOME (default ~/.dsh), and its
# filesystem skill provider scans ~/.agents/skills; with HOME on the persisted
# /config mount both survive container restarts.
ENV HOME=/config
ENV TERM=xterm-256color

RUN mkdir -p /config/.dsh /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

# The socat forwarder's listen port (see entrypoint.sh); dsh itself binds
# loopback 3080, so this must stay a different port.
EXPOSE 3081

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["dsh", "web", "--no-open"]
