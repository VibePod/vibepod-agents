# ECA (Editor Code Assistant) is two binaries from two GitHub repositories:
# the `eca` server (a GraalVM native image that does the chat, tools,
# providers and MCP) and `eca-cli`, its terminal client, which spawns
# `eca server` and talks to it over stdio. VibePod runs the client.
# Trixie is required: the upstream aarch64 server links against glibc >= 2.39
# (the x86_64 one is fully static), and bookworm ships 2.36.
FROM debian:trixie-slim
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG TZ
ENV TZ="${TZ:-UTC}"

# ripgrep: ECA's grep tool prefers rg and falls back to grep.
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    ripgrep \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ECA_VERSION is the tracked version: automation passes the server's GitHub
# release tag (e.g. "0.173.1"). eca-cli is released on every push to its main
# branch and is built against the newest server, so the image takes its latest
# release at build time unless ECA_CLI_VERSION pins one (e.g. "0.1.107").
# Both are checked against the .sha256 files published next to the assets.
# With `eca` on PATH, eca-cli runs it and never downloads or updates a server
# of its own into the persisted mount.
ARG ECA_VERSION=0.173.1
ARG ECA_CLI_VERSION=latest
ARG TARGETARCH
RUN case "${TARGETARCH:-amd64}" in \
        amd64) ECA_ASSET=eca-native-static-linux-amd64.zip; ECA_CLI_ARCH=amd64 ;; \
        arm64) ECA_ASSET=eca-native-linux-aarch64.zip; ECA_CLI_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && ECA_URL="https://github.com/editor-code-assistant/eca/releases/download/${ECA_VERSION#v}" \
    && if [ "${ECA_CLI_VERSION}" = latest ]; then \
           ECA_CLI_URL="https://github.com/editor-code-assistant/eca-cli/releases/latest/download"; \
       else \
           ECA_CLI_URL="https://github.com/editor-code-assistant/eca-cli/releases/download/${ECA_CLI_VERSION#v}"; \
       fi \
    && ECA_CLI_ASSET="eca-cli-linux-${ECA_CLI_ARCH}.tar.gz" \
    && DL=/tmp/eca-dl \
    && mkdir -p "${DL}" \
    && curl -fsSL -o "${DL}/${ECA_ASSET}" "${ECA_URL}/${ECA_ASSET}" \
    && curl -fsSL -o "${DL}/${ECA_ASSET}.sha256" "${ECA_URL}/${ECA_ASSET}.sha256" \
    && curl -fsSL -o "${DL}/${ECA_CLI_ASSET}" "${ECA_CLI_URL}/${ECA_CLI_ASSET}" \
    && curl -fsSL -o "${DL}/${ECA_CLI_ASSET}.sha256" "${ECA_CLI_URL}/${ECA_CLI_ASSET}.sha256" \
    # The server's .sha256 holds the bare digest, eca-cli's `<digest>  <name>`;
    # the first field is the digest either way.
    && echo "$(cut -d ' ' -f 1 "${DL}/${ECA_ASSET}.sha256")  ${DL}/${ECA_ASSET}" | sha256sum -c - \
    && echo "$(cut -d ' ' -f 1 "${DL}/${ECA_CLI_ASSET}.sha256")  ${DL}/${ECA_CLI_ASSET}" | sha256sum -c - \
    && unzip -q "${DL}/${ECA_ASSET}" eca -d /usr/local/bin \
    && tar -xzf "${DL}/${ECA_CLI_ASSET}" --no-same-owner -C /usr/local/bin eca-cli \
    && chmod 755 /usr/local/bin/eca /usr/local/bin/eca-cli \
    && rm -rf "${DL}" \
    && HOME=/tmp/eca-version eca --version \
    && HOME=/tmp/eca-version eca-cli --version \
    && rm -rf /tmp/eca-version

# ECA keeps config.json, AGENTS.md, rules, commands and skills in
# $XDG_CONFIG_HOME/eca, its logins (db.transit.json) and per-workspace chats in
# $XDG_CACHE_HOME/eca, and eca-cli its own state in $XDG_STATE_HOME/eca.
# VibePod mounts the agent config directory at /config. The XDG variables are
# set explicitly because the server, like any JVM program, takes ~ from the
# passwd entry rather than from $HOME, and not every runtime gives that entry
# the persisted home (rootless Podman generates its own).
ENV HOME=/config \
    XDG_CONFIG_HOME=/config/.config \
    XDG_CACHE_HOME=/config/.cache \
    XDG_STATE_HOME=/config/.local/state

# Set a standard terminal type so the TUI renders correctly, and default to a
# UTF-8 locale (C.UTF-8 ships with glibc) when the host passes no LANG.
ENV TERM=xterm-256color \
    LANG=C.UTF-8

RUN mkdir -p /config/.config/eca /config/.cache/eca /config/.local/state/eca \
    /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["eca-cli"]
