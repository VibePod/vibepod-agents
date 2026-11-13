# Warp Agent CLI is closed source and ships as a per-arch tarball from
# releases.warp.dev: a single glibc-linked binary (`warp-tui-stable`) plus a
# sibling `resources/` directory, so the image only needs glibc, bash and the
# usual tooling.
FROM debian:bookworm-slim
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG TZ
ENV TZ="${TZ:-UTC}"

# dbus + gnome-keyring: Warp keeps its login, provider API keys and MCP
# credentials in "secure storage", which on Linux is the Secret Service D-Bus
# API with no file fallback. Without a provider the CLI logs "no secret service
# provider or dbus session found" and forgets the login when the container
# exits. The entrypoint starts a private session bus and an unlocked keyring
# whose files live on the persisted mount (see keyring-session.sh).
# dbus-x11 rather than dbus: gnome-keyring depends on a session bus provider,
# and apt's default choice (dbus-user-session) drags systemd into the image.
# dbus-x11 provides it with just dbus-daemon and the session bus config.
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    dbus-x11 \
    git \
    gnome-keyring \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Versions are channel builds (e.g. v0.2026.11.11.08.17.stable_01). Upstream's
# installer (https://app.warp.dev/download/agent-cli) resolves the current one
# from the redirect of its artifact endpoint and publishes no checksums for
# the tarball. Automation reads the version from that same redirect.
ARG WARP_VERSION=v0.2026.11.11.08.17.stable_01
ARG TARGETARCH
RUN case "${TARGETARCH:-amd64}" in \
        amd64) WARP_ARCH=x86_64 ;; \
        arm64) WARP_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && mkdir -p /opt/warp \
    && curl -fsSL "https://releases.warp.dev/stable/${WARP_VERSION}/tui/linux/${WARP_ARCH}/warp-tui-stable-linux-${WARP_ARCH}.tar.gz" \
        | tar -xzf - -C /opt/warp \
    && chown -R root:root /opt/warp \
    && chmod -R a+rX /opt/warp \
    # The binary loads its bundled skills and settings schema from the sibling
    # resources/ directory; fail the build if the package layout moved either.
    && test -x /opt/warp/warp-tui-stable \
    && test -d /opt/warp/resources \
    # Upstream's installer links `warp` to the channel binary the same way.
    && ln -sf /opt/warp/warp-tui-stable /usr/local/bin/warp \
    && HOME=/tmp/warp-version WARP_TUI_DISABLE_AUTOUPDATE=1 warp --version \
    && rm -rf /tmp/warp-version

# Warp derives all user state from HOME: ~/.config/warp-terminal (settings,
# preferences), ~/.local/state/warp-terminal (conversation database, logs),
# ~/.local/share/keyrings (the keyring holding the login) and ~/.agents
# (skills, global rules). VibePod mounts the agent config directory at /config.
ENV HOME=/config

# Set a standard terminal type so the TUI renders correctly.
ENV TERM=xterm-256color

# The background self-update would stage a full ~250MB build under
# ~/.warp/tui on the persisted mount on every release, while the image keeps
# running its baked-in /opt/warp.
ENV WARP_TUI_DISABLE_AUTOUPDATE=1

RUN mkdir -p /config/.config/warp-terminal /config/.local/state/warp-terminal \
    /config/.local/share/keyrings /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY keyring-session.sh /usr/local/bin/keyring-session.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/keyring-session.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["warp"]
