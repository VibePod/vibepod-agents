FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Devstral Vibe CLI and set up PATH
# The install script modifies shell config, so we need to source it
RUN curl -LsSf https://mistral.ai/vibe/install.sh | bash && \
    # Source the shell profile to get the updated PATH
    if [ -f /root/.bashrc ]; then . /root/.bashrc; fi && \
    if [ -f /root/.profile ]; then . /root/.profile; fi && \
    # Make vibe installation accessible to non-root users
    # (uv installs to /root/.local which is not world-readable by default)
    chmod 755 /root && \
    chmod -R 755 /root/.local && \
    # Symlink vibe to /usr/local/bin for PATH access
    VIBE_PATH=$(find /root -name vibe -type f -executable 2>/dev/null | head -1) && \
    if [ -n "$VIBE_PATH" ]; then \
        ln -s "$VIBE_PATH" /usr/local/bin/vibe && \
        echo "Vibe installed at: $VIBE_PATH"; \
    else \
        echo "ERROR: Vibe binary not found after installation" && exit 1; \
    fi

# Create config directory
RUN mkdir -p /root/.vibe

# Set working directory
WORKDIR /workspace

# Default command - use shell to load environment
CMD ["/bin/bash", "-l", "-c", "vibe"]
