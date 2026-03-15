# Use Debian (glibc). Claude native binaries currently fail on musl/Alpine.
FROM debian:bookworm-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    jq \
    libgcc-s1 \
    libstdc++6 \
    passwd \
    python3 \
    ripgrep \
    xclip \
    && rm -rf /var/lib/apt/lists/*

ARG CLAUDE_CODE_CHANNEL=latest

# Install Claude Code using the native installer (npm install is deprecated).
RUN curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_CHANNEL}" \
    && test -x /root/.local/bin/claude \
    && ln -sf /root/.local/bin/claude /usr/local/bin/claude \
    && chmod 755 /root \
    && chmod -R a+rX /root/.local

# Ensure ~/.local/bin is on PATH (used by the native installer).
ENV PATH="/root/.local/bin:${PATH}"

# Create directories
RUN mkdir -p /claude /workspace

# Use system ripgrep in the container.
ENV USE_BUILTIN_RIPGREP=0

# Disable the auto-updater: containers use a fixed, baked-in version of Claude
# Code and attempting an in-place self-update would waste time, clutter the
# filesystem, and potentially fail silently.  Pin the version via the
# CLAUDE_CODE_CHANNEL build arg instead.
ENV DISABLE_AUTOUPDATER=1

# Opt out of background telemetry / error-reporting that is not meaningful in
# an ephemeral container context and may cause unnecessary outbound traffic.
ENV DISABLE_TELEMETRY=1
ENV DISABLE_ERROR_REPORTING=1

# Set a standard terminal type so Claude Code's TUI renders colours and cursor
# sequences correctly even when no real TTY is attached.
ENV TERM=xterm-256color

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["claude"]
