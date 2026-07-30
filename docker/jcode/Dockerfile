# jcode is a Rust agent released as per-arch glibc tarballs on GitHub.
# Trixie is required: the upstream aarch64 binary links against glibc >= 2.39
# (the x86_64 one only needs 2.17), and bookworm ships 2.36.
FROM debian:trixie-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Containers run a fixed, baked-in version; a new image is published per
# release. Telemetry is not meaningful from throwaway containers. Set before
# the install step so the build-time version check runs with both in effect.
ENV JCODE_NO_AUTO_UPDATE=1 \
    JCODE_NO_TELEMETRY=1

# Automation passes the raw GitHub release tag (e.g. "v0.61.1"), so strip any
# leading "v" before composing the download URL.
ARG JCODE_VERSION=0.61.1
ARG TARGETARCH
# hadolint ignore=DL3003
RUN case "${TARGETARCH:-amd64}" in \
        amd64) JCODE_ARCH=x86_64 ;; \
        arm64) JCODE_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && JCODE_TAG="v${JCODE_VERSION#v}" \
    && BASE_URL="https://github.com/1jehuang/jcode/releases/download/${JCODE_TAG}" \
    && mkdir -p /opt/jcode /tmp/jcode-dl \
    && cd /tmp/jcode-dl \
    && curl -fsSL -O "${BASE_URL}/jcode-linux-${JCODE_ARCH}.tar.gz" \
    # Verify against the release's published SHA256SUMS before extracting.
    # The checksum file is version-specific, so automation version bumps keep
    # working; --ignore-missing still fails if no listed file was checked.
    && curl -fsSL -O "${BASE_URL}/SHA256SUMS" \
    && sha256sum -c --ignore-missing SHA256SUMS \
    && tar -xzf "jcode-linux-${JCODE_ARCH}.tar.gz" -C /opt/jcode \
    && cd / \
    && rm -rf /tmp/jcode-dl \
    # Tarball layouts differ per arch: x86_64 ships a launcher script plus the
    # actual binary (jcode-linux-x86_64 + jcode-linux-x86_64.bin), aarch64
    # ships the bare jcode-linux-aarch64 binary. Both expose an executable
    # named jcode-linux-<arch>; the launcher resolves symlinks, so a
    # /usr/local/bin symlink keeps sibling files together.
    && ln -sf "/opt/jcode/jcode-linux-${JCODE_ARCH}" /usr/local/bin/jcode \
    && chmod -R a+rX /opt/jcode \
    && jcode --version \
    # Drop any first-run state the version check may have written under /root.
    && rm -rf /root/.jcode

ENV HOME=/config

# Set a standard terminal type so the TUI renders correctly.
ENV TERM=xterm-256color

RUN mkdir -p /config/.jcode /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["jcode"]
