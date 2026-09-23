# Cursor CLI (cursor-agent) is closed source and ships as a per-arch tarball
# from downloads.cursor.com: a bash launcher plus a bundled Node.js runtime and
# native modules, so the image only needs glibc, bash and the usual tooling.
FROM debian:bookworm-slim
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Versions are date+commit builds (e.g. 2026.09.23-86fc751). Upstream's
# installer (https://cursor.com/install) hardcodes the same versioned URL, and
# publishes no checksums for it. Automation reads the current version from
# that installer script.
ARG CURSOR_VERSION=2026.09.23-86fc751
ARG TARGETARCH
RUN case "${TARGETARCH:-amd64}" in \
        amd64) CURSOR_ARCH=x64 ;; \
        arm64) CURSOR_ARCH=arm64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && mkdir -p /opt/cursor-agent \
    && curl -fsSL "https://downloads.cursor.com/lab/${CURSOR_VERSION}/linux/${CURSOR_ARCH}/agent-cli-package.tar.gz" \
        | tar --strip-components=1 -xzf - -C /opt/cursor-agent \
    && chmod -R a+rX /opt/cursor-agent \
    # The launcher resolves its own symlink to find the bundled node, so both
    # upstream command names can point at it.
    && ln -sf /opt/cursor-agent/cursor-agent /usr/local/bin/cursor-agent \
    && ln -sf /opt/cursor-agent/cursor-agent /usr/local/bin/agent \
    && HOME=/tmp/cursor-version cursor-agent --version \
    && rm -rf /tmp/cursor-version

# Cursor derives all user state from HOME: ~/.cursor (cli-config.json, chats,
# projects, skills), ~/.config/cursor/auth.json (Linux has no keychain store)
# and ~/.agents/skills. VibePod mounts the agent config directory at /config.
ENV HOME=/config

# Set a standard terminal type so the TUI renders correctly.
ENV TERM=xterm-256color

RUN mkdir -p /config/.cursor /config/.config/cursor /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["cursor-agent"]
