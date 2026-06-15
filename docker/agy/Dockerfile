# Use Debian (glibc). Antigravity CLI native binaries require glibc, not musl/Alpine.
FROM debian:bookworm-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install Antigravity CLI using the official installer.
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash \
    && test -x /root/.local/bin/agy \
    && ln -sf /root/.local/bin/agy /usr/local/bin/agy \
    && chmod 755 /root \
    && chmod -R a+rX /root/.local

# Ensure ~/.local/bin is on PATH (used by the native installer).
ENV PATH="/root/.local/bin:${PATH}"

# Create directories
RUN mkdir -p /agy /workspace

# Disable the auto-updater: containers use a fixed, baked-in version.
ENV AGY_CLI_DISABLE_AUTO_UPDATE=1

# Set a standard terminal type so the TUI renders correctly.
ENV TERM=xterm-256color

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["agy"]
