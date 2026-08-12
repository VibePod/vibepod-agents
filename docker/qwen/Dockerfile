FROM node:22-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Qwen Code CLI (official npm package; binaries are bundled)
RUN npm install -g @qwen-code/qwen-code@0.21.10

# Create directories for persistent config and workspace.
# /qwen is the mount-point VibePod maps to a persistent volume so that
# auth tokens, settings, and session data survive container restarts.
# The entrypoint symlinks ~/.qwen -> /qwen so qwen's hardcoded config path
# lands on the persisted volume.
RUN mkdir -p /qwen /workspace

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["qwen"]
