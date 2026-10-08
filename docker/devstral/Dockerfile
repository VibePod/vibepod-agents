FROM debian:bookworm-slim
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    bash \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Devstral Vibe CLI and set up PATH
# The install script exits non-zero when PATH doesn't include ~/.local/bin, so suppress that.
# Pin uv to Python 3.12 so it picks the prebuilt wheel: with Debian's 3.11 present, uv
# re-resolves against a downloaded 3.12 and falls back to the sdist, which needs cargo.
RUN curl -LsSf https://mistral.ai/vibe/install.sh | UV_PYTHON=3.12 bash || true && \
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
