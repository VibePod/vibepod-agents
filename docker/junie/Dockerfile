# Junie CLI (JetBrains) ships as a jpackage app bundle (launcher + JetBrains
# Runtime + application jar) in per-arch zips on the JetBrains/junie GitHub
# releases. Only glibc >= 2.14 is needed, so no particular Debian release is
# required; trixie matches the other binary-download images.
FROM debian:trixie-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Containers run a fixed, baked-in version; a new image is published per
# release, so Junie's own update check (which stages new builds under
# ~/.local/share/junie) is disabled.
ENV JUNIE_SKIP_UPDATE_CHECK=true

# Automation tracks the npm package @jetbrains/junie (e.g. "3110.7.0"), whose
# postinstall downloads the matching GitHub release. The release tag is the
# npm version without its trailing ".0" (package.json "junieVersion"). The
# GitHub "latest" release is a nightly build, so the release feed cannot be
# tracked directly. The releases publish no checksum files.
ARG JUNIE_VERSION=3110.7.0
ARG TARGETARCH
# hadolint ignore=DL3003
RUN case "${TARGETARCH:-amd64}" in \
        amd64) JUNIE_ARCH=amd64 ;; \
        arm64) JUNIE_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && JUNIE_TAG="${JUNIE_VERSION%.0}" \
    && mkdir -p /opt/junie /tmp/junie-dl \
    && cd /tmp/junie-dl \
    && curl -fsSL -o junie.zip \
        "https://github.com/JetBrains/junie/releases/download/${JUNIE_TAG}/junie-release-${JUNIE_TAG}-linux-${JUNIE_ARCH}.zip" \
    && unzip -q junie.zip -d /opt/junie \
    && cd / \
    && rm -rf /tmp/junie-dl \
    && chmod -R a+rX /opt/junie \
    && chmod a+x /opt/junie/junie-app/bin/junie \
    # The jpackage launcher resolves its app dir from /proc/self/exe, so a
    # symlink onto PATH keeps the bundled runtime and jar reachable.
    && ln -sf /opt/junie/junie-app/bin/junie /usr/local/bin/junie \
    && JUNIE_HOME=/tmp/junie-version-check junie --version \
    && rm -rf /tmp/junie-version-check

ENV HOME=/config
# Junie keeps settings, credentials (secure_credentials.json when no Secret
# Service is available), sessions, skills and MCP config under $JUNIE_HOME.
ENV JUNIE_HOME=/config/.junie

# Set a standard terminal type so the TUI renders correctly.
ENV TERM=xterm-256color

RUN mkdir -p /config/.junie/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["junie"]
