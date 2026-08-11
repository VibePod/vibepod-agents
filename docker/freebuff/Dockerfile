FROM node:22-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Freebuff CLI (thin npm launcher; downloads native binary on first run)
RUN npm install -g freebuff

# Create directories for persistent config and workspace.
# /freebuff is the mount-point VibePod maps to a persistent volume so that
# auth tokens, the downloaded native binary, and session history survive
# container restarts. The entrypoint symlinks ~/.config/manicode -> /freebuff
# so freebuff's hardcoded config path lands on the persisted volume.
RUN mkdir -p /freebuff /workspace

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["freebuff"]
