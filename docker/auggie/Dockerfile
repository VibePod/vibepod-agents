FROM node:22-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install auggie CLI
RUN npm install -g @augmentcode/auggie

# Create directories for config and workspace
RUN mkdir -p /auggie /workspace

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["auggie"]
