FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Devstral Vibe CLI and set up PATH
# The install script exits non-zero when PATH doesn't include ~/.local/bin, so suppress that.
RUN curl -LsSf https://mistral.ai/vibe/install.sh | bash || true && \
    # Make vibe installation accessible to non-root users
    chmod 755 /root && \
    chmod -R 755 /root/.local && \
    # Symlink vibe binaries to /usr/local/bin (known install location)
    ln -sf /root/.local/bin/vibe /usr/local/bin/vibe && \
    ln -sf /root/.local/bin/vibe-acp /usr/local/bin/vibe-acp && \
    vibe --version

# Create config directory
RUN mkdir -p /root/.vibe

# Set working directory
WORKDIR /workspace

# Default command - use shell to load environment
CMD ["/bin/bash", "-l", "-c", "vibe"]
